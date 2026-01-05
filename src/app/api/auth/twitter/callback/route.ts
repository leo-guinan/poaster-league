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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Get OAuth cookies from request
    const codeVerifier = request.cookies.get("oauth_code_verifier")?.value;
    const storedState = request.cookies.get("oauth_state")?.value;

    if (!user) {
      return NextResponse.redirect(
        `${baseUrl}/write?error=not_authenticated`
      );
    }

    const userId = user.id;

    logger.debug("OAuth callback received");

    if (!codeVerifier || !storedState) {
      logger.error("Missing OAuth cookies in callback");
      return NextResponse.redirect(
        `${baseUrl}/write?error=missing_verifier`
      );
    }

    if (state !== storedState) {
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

    // Update user's Twitter identity in Supabase
    await supabase.from("users").update({
      twitter_user_id: twitterUser.data.id,
      handle: twitterUser.data.username,
      name: twitterUser.data.name,
      avatar_url: twitterUser.data.profile_image_url,
      twitter_verified: true,
    }).eq("id", userId);

    // Check Community Archive eligibility
    const { checkCommunityArchiveEligibility } = await import("@/lib/user-state");
    const isEligible = await checkCommunityArchiveEligibility(twitterUser.data.id);
    
    if (isEligible) {
      await supabase.from("users").update({
        write_permission: true,
      }).eq("id", userId);
    }

    // Create redirect response, preserving Supabase session cookies
    // The supabaseResponse already has all the Supabase cookies set
    const redirectUrl = `${baseUrl}/write?connected=twitter`;
    const response = NextResponse.redirect(redirectUrl);
    
    // Copy all cookies from supabaseResponse to the redirect response
    // This preserves the Supabase session cookies
    // The supabaseResponse cookies already have the correct options set by Supabase
    const allCookies = supabaseResponse.cookies.getAll();
    allCookies.forEach((cookie) => {
      // Copy Supabase session cookies (sb-* prefix) and any other cookies Supabase set
      if (cookie.name.startsWith("sb-")) {
        // The cookie value from supabaseResponse is what we need
        // We'll set it with standard secure options
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }
    });
    
    // Delete OAuth cookies
    response.cookies.delete("oauth_code_verifier");
    response.cookies.delete("oauth_state");

    return response;
  } catch (error) {
    logger.error("Error in Twitter OAuth callback:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.redirect(
      `${baseUrl}/write?error=${encodeURIComponent(
        error instanceof Error ? error.message : "authentication_failed"
      )}`
    );
  }
}

