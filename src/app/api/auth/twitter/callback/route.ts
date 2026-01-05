import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/twitter-auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { cookies } from "next/headers";

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
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get("oauth_code_verifier")?.value;
    const storedState = cookieStore.get("oauth_state")?.value;
    
    // Get authenticated user from Supabase
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Clear OAuth cookies and create redirect response
    // IMPORTANT: We need to preserve Supabase session cookies in the redirect
    // The Supabase client manages cookies through the cookieStore, but when we
    // create a redirect, we need to ensure those cookies are included in the response
    
    const redirectUrl = `${baseUrl}/write?connected=twitter`;
    
    // Get all cookies from the store (Supabase may have updated them)
    const allCookies = cookieStore.getAll();
    
    // Create redirect response
    const response = NextResponse.redirect(redirectUrl);
    
    // Delete OAuth cookies
    response.cookies.delete("oauth_code_verifier");
    response.cookies.delete("oauth_state");
    
    // Copy all Supabase-related cookies to the redirect response
    // Supabase uses cookies with "sb-" prefix for session management
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith("sb-")) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }
    });

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

