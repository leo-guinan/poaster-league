import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/twitter-auth";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/write?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/write?error=missing_code_or_state`
    );
  }

  try {
    // Create a response object that we'll update as Supabase sets cookies
    let supabaseResponse = NextResponse.next({ request });
    
    // Create Supabase client using request/response pattern (like middleware)
    // This ensures cookies are properly managed in the redirect response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Get authenticated user from Supabase
    // IMPORTANT: Call getUser() BEFORE reading cookies, as Supabase may update cookie values
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    
    // After getUser(), Supabase may have updated cookies in supabaseResponse
    // Also get cookies from request (which may have been updated by Supabase's setAll callback)
    const cookiesAfterGetUser = request.cookies.getAll();
    
    // Log what cookies Supabase might have set/updated
    const supabaseResponseCookiesAfter = supabaseResponse.cookies.getAll();
    logger.debug(`After getUser(): supabaseResponse has ${supabaseResponseCookiesAfter.length} cookies, request has ${cookiesAfterGetUser.length} cookies`);
    
    // Get OAuth cookies from request
    const codeVerifier = request.cookies.get("oauth_code_verifier")?.value;
    const storedState = request.cookies.get("oauth_state")?.value;

    // Log all cookies for debugging
    logger.debug(`OAuth callback received. Request has ${cookiesAfterGetUser.length} cookies`);
    const allCookieNames = cookiesAfterGetUser.map((c: { name: string }) => c.name).join(", ");
    logger.debug(`All cookies in request: ${allCookieNames}`);
    const supabaseCookieNames = cookiesAfterGetUser.filter((c: { name: string }) => c.name.startsWith("sb-")).map((c: { name: string }) => c.name).join(", ");
    logger.debug(`Supabase cookies in request: ${supabaseCookieNames || "none"}`);
    
    // Log cookie values (truncated for security)
    cookiesAfterGetUser.filter((c: { name: string }) => c.name.startsWith("sb-")).forEach((cookie: { name: string; value: string }) => {
      logger.debug(`  ${cookie.name}: ${cookie.value.substring(0, 50)}... (${cookie.value.length} chars)`);
    });

    if (!user) {
      logger.error("No authenticated user found in callback", {
        userError: userError?.message,
        hasSupabaseCookies: cookiesAfterGetUser.some((c: { name: string }) => c.name.startsWith("sb-")),
      });
      return NextResponse.redirect(
        `${baseUrl}/write?error=not_authenticated`
      );
    }

    const userId = user.id;
    logger.debug(`OAuth callback for user: ${userId}`);

    if (!codeVerifier || !storedState) {
      logger.error("Missing OAuth cookies in callback", {
        hasCodeVerifier: !!codeVerifier,
        hasStoredState: !!storedState,
        allCookieNames: cookiesAfterGetUser.map((c: { name: string }) => c.name).join(", "),
      });
      return NextResponse.redirect(
        `${baseUrl}/write?error=missing_verifier`
      );
    }

    if (state !== storedState) {
      logger.error("State mismatch in OAuth callback", {
        receivedState: state,
        storedState: storedState,
      });
      return NextResponse.redirect(
        `${baseUrl}/write?error=invalid_state`
      );
    }

    // Exchange code for token (this stores tokens in Supabase)
    const tokenResult = await exchangeCodeForToken(
      code,
      codeVerifier,
      state,
      userId,
      baseUrl
    );

    // Get Twitter user info
    const { TwitterApi } = await import("twitter-api-v2");
    const twitterClient = new TwitterApi(tokenResult.accessToken);
    const twitterUser = await twitterClient.v2.me();

    // Check if there's a placeholder account for this Twitter ID
    const { data: placeholder } = await supabase
      .from("placeholder_accounts")
      .select("*")
      .eq("twitter_user_id", twitterUser.data.id)
      .is("claimed_by", null)
      .maybeSingle();

    // Prepare user data (use placeholder data if available, otherwise use Twitter data)
    const userData: {
      twitter_user_id: string;
      handle: string;
      name: string;
      avatar_url?: string;
      twitter_verified: boolean;
      write_permission?: boolean;
    } = {
      twitter_user_id: twitterUser.data.id,
      handle: placeholder?.handle || twitterUser.data.username,
      name: placeholder?.name || twitterUser.data.name,
      avatar_url: placeholder?.avatar_url || twitterUser.data.profile_image_url,
      twitter_verified: true,
    };

    // Check Community Archive eligibility
    const { checkCommunityArchiveEligibility } = await import("@/lib/user-state");
    const isEligible = await checkCommunityArchiveEligibility(twitterUser.data.id);
    
    if (isEligible) {
      userData.write_permission = true;
    }

    // Update user's Twitter identity in Supabase
    await supabase.from("users").update(userData).eq("id", userId);

    // If placeholder exists, mark it as claimed and link posts
    if (placeholder) {
      await supabase
        .from("placeholder_accounts")
        .update({
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
          // Update placeholder with latest Twitter data
          handle: twitterUser.data.username,
          name: twitterUser.data.name,
          avatar_url: twitterUser.data.profile_image_url,
        })
        .eq("id", placeholder.id);

      logger.info(`Placeholder account claimed: @${twitterUser.data.username} (${twitterUser.data.id})`);
      
      // Note: Posts created before claiming will have user_id = null
      // To link them, we'd need to store placeholder_account_id in posts table
      // For now, new posts will be linked correctly after claiming
    }

    // Create redirect response, preserving Supabase session cookies
    // CRITICAL: Start with supabaseResponse and modify it to redirect
    // This preserves ALL cookies that Supabase set, with their original attributes
    const redirectUrl = `${baseUrl}/write?connected=twitter`;
    
    // Get all cookies from both sources AFTER getUser() call
    const supabaseResponseCookies = supabaseResponseCookiesAfter;
    const requestCookies = cookiesAfterGetUser;
    const supabaseRequestCookies = requestCookies.filter(c => c.name.startsWith("sb-"));
    
    logger.debug(`supabaseResponse has ${supabaseResponseCookies.length} cookies, request has ${supabaseRequestCookies.length} Supabase cookies`);
    logger.debug(`All Supabase cookie names in request: ${supabaseRequestCookies.map(c => c.name).join(", ")}`);
    logger.debug(`All cookie names in supabaseResponse: ${supabaseResponseCookies.map(c => c.name).join(", ") || "none"}`);
    
    // Create redirect response
    // We'll copy cookies to it, ensuring we preserve the session
    const response = NextResponse.redirect(redirectUrl);
    
    // Create a map to track which cookies we've set (supabaseResponse takes precedence)
    const cookiesSet = new Set<string>();
    
    // CRITICAL STEP 1: Copy ALL cookies from supabaseResponse first
    // These are the cookies that Supabase set/updated during getUser()
    // Use the cookie's original value and set with proper attributes
    supabaseResponseCookies.forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      cookiesSet.add(cookie.name);
      logger.debug(`✓ Copied cookie from supabaseResponse: ${cookie.name}`);
    });
    
    // CRITICAL STEP 2: Copy ALL Supabase cookies from the request (after getUser() call)
    // This preserves the existing session even if Supabase didn't set new cookies
    // (which happens when the session is already valid - Supabase doesn't update cookies)
    // We MUST copy these to preserve the session across the redirect
    supabaseRequestCookies.forEach((cookie) => {
      // Only set if not already set from supabaseResponse (supabaseResponse takes precedence)
      if (!cookiesSet.has(cookie.name)) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
        cookiesSet.add(cookie.name);
        logger.debug(`✓ Copied Supabase cookie from request: ${cookie.name}`);
      } else {
        logger.debug(`⊘ Skipped ${cookie.name} (already set from supabaseResponse)`);
      }
    });
    
    // Delete OAuth cookies (cleanup)
    response.cookies.delete("oauth_code_verifier");
    response.cookies.delete("oauth_state");

    // Verify what we're actually sending
    const finalCookies = response.cookies.getAll();
    const finalSupabaseCookies = finalCookies.filter(c => c.name.startsWith("sb-"));
    logger.debug(`Final response has ${finalCookies.length} total cookies, ${finalSupabaseCookies.length} Supabase cookies`);
    logger.debug(`Supabase cookies being sent: ${finalSupabaseCookies.map(c => `${c.name} (${c.value.length} chars)`).join(", ")}`);
    
    if (finalSupabaseCookies.length === 0) {
      logger.error("WARNING: No Supabase cookies in final response! Session will be lost.");
    } else {
      // Verify the cookie value is not empty
      finalSupabaseCookies.forEach((cookie) => {
        if (!cookie.value || cookie.value.length === 0) {
          logger.error(`WARNING: Cookie ${cookie.name} has empty value!`);
        }
      });
    }
    
    logger.debug("OAuth callback completed successfully, redirecting to write page");
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in Twitter OAuth callback:", errorMessage);
    
    // Provide user-friendly error messages
    let userFriendlyMessage = "authentication_failed";
    if (errorMessage.includes("rate limit")) {
      userFriendlyMessage = "Twitter API rate limit exceeded. Please wait a few minutes and try again.";
    } else if (errorMessage.includes("429")) {
      userFriendlyMessage = "Twitter API rate limit exceeded. Please wait a few minutes and try again.";
    } else if (errorMessage.includes("invalid") || errorMessage.includes("expired")) {
      userFriendlyMessage = "Twitter authentication failed. Please try connecting again.";
    }
    
    return NextResponse.redirect(
      `${baseUrl}/write?error=${encodeURIComponent(userFriendlyMessage)}`
    );
  }
}

