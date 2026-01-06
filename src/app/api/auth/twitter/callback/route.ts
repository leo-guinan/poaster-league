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

    // Ensure user exists in users table before OAuth (required for foreign key)
    const { data: userExists } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    
    if (!userExists) {
      logger.debug("User not found in users table, creating user record", { userId });
      const { error: createUserError } = await supabase
        .from("users")
        .insert({
          id: userId,
          write_permission: false,
          scout_active: false,
        });
      
      if (createUserError) {
        logger.error("Error creating user record in callback:", {
          userId,
          error: createUserError.message,
          code: createUserError.code,
        });
        // Continue anyway - might be a race condition
      } else {
        logger.debug("User record created successfully", { userId });
      }
    }

    // Exchange code for token (this stores tokens in Supabase)
    // Note: User info may not be available if v2.me() was rate limited
    logger.debug("Starting Twitter OAuth token exchange", {
      userId,
      hasCode: !!code,
      timestamp: new Date().toISOString(),
    });
    
    const tokenResult = await exchangeCodeForToken(
      code,
      codeVerifier,
      state,
      userId,
      baseUrl,
      supabase // Pass the Supabase client with proper session context
    );

    // Get Twitter user info - either from token exchange or fetch it now
    // If both fail due to rate limits, we'll still complete OAuth and fetch user info later
    let twitterUser: { data: { id: string; username: string; name: string; profile_image_url?: string } } | null = null;
    
    if (tokenResult.twitterUser) {
      // Use the user info we already got from exchangeCodeForToken
      logger.debug("Using Twitter user info from token exchange", {
        twitterUserId: tokenResult.twitterUser.id,
        username: tokenResult.twitterUser.username,
      });
      twitterUser = {
        data: tokenResult.twitterUser,
      };
    } else {
      // User info wasn't available (likely rate limited), try to fetch it now
      logger.debug("Twitter user info not available from token exchange, attempting to fetch now", {
        timestamp: new Date().toISOString(),
      });
      
      try {
        const { TwitterApi } = await import("twitter-api-v2");
        const twitterClient = new TwitterApi(tokenResult.accessToken);
        const user = await twitterClient.v2.me();
        twitterUser = user;
        
        // Update tokens with user info
        await supabase
          .from("twitter_tokens")
          .update({
            twitter_user_id: user.data.id,
            twitter_username: user.data.username || null,
          })
          .eq("user_id", userId);
        
        logger.debug("Twitter user info fetched successfully", {
          twitterUserId: user.data.id,
          username: user.data.username,
        });
      } catch (error: unknown) {
        const errorObj = error as { code?: string; status?: number; message?: string };
        const errorCode = errorObj.code || errorObj.status?.toString();
        
        // If rate limited, log but continue - tokens are stored, user info can be fetched later
        if (errorCode === "429" || errorObj.status === 429) {
          logger.warn("Twitter API v2.me() rate limited - OAuth will complete but user info will be fetched later", {
            timestamp: new Date().toISOString(),
          });
          // Continue without user info - we'll fetch it later via a background job or on next request
        } else {
          // For other errors, log but still continue - tokens are stored
          logger.warn("Failed to get Twitter user info (non-fatal):", {
            code: errorCode,
            message: errorObj.message,
          });
        }
      }
    }

    // Only update user data if we have Twitter user info
    // If rate limited, tokens are stored and we can update user info later
    if (twitterUser) {
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
    } else {
      // User info not available due to rate limiting
      // Try to get Twitter user ID from tokens table (might have been stored there)
      const { data: tokenData } = await supabase
        .from("twitter_tokens")
        .select("twitter_user_id, twitter_username")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (tokenData?.twitter_user_id) {
        // We have the Twitter user ID from tokens, use it to update user record
        logger.debug("Found Twitter user ID in tokens table, updating user record", {
          twitterUserId: tokenData.twitter_user_id,
        });
        
        // Check Community Archive eligibility even when rate limited
        const { checkCommunityArchiveEligibility } = await import("@/lib/user-state");
        const isEligible = await checkCommunityArchiveEligibility(tokenData.twitter_user_id);
        
        await supabase.from("users").update({
          twitter_user_id: tokenData.twitter_user_id,
          handle: tokenData.twitter_username || null,
          twitter_verified: true,
          write_permission: isEligible, // Auto-grant if in Community Archive
          // Don't set name/avatar yet - will be updated when full user info is fetched
        }).eq("id", userId);
        
        if (isEligible) {
          logger.info("User found in Community Archive, write access automatically granted", {
            userId,
            twitterUserId: tokenData.twitter_user_id,
          });
        }
      } else {
        // No user ID available - mark as verified but will need to fetch user info later
        await supabase.from("users").update({
          twitter_verified: true,
          // Don't set other fields yet - will be updated when user info is fetched
        }).eq("id", userId);
        
        logger.info("Twitter OAuth completed but no user info available (rate limited) - will be fetched later", {
          userId,
        });
      }
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

