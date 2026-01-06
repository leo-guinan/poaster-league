import { NextResponse } from "next/server";
import { getUserTwitterAuth } from "@/lib/twitter-auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      logger.error("Error getting user from Supabase:", userError.message);
    }

    if (!user) {
      logger.debug("Twitter status check: No authenticated user.", {
        error: userError?.message,
      });
      return NextResponse.json({ authenticated: false });
    }

    logger.debug(`Twitter status check for user: ${user.id}`);

    // Check if Twitter tokens exist (even if user info wasn't fetched due to rate limits)
    // If tokens exist, Twitter is connected
    const { data: tokenData, error: tokenError } = await supabase
      .from("twitter_tokens")
      .select("twitter_user_id, twitter_username, access_token, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenError) {
      logger.error(`Error querying twitter_tokens for user ${user.id}:`, {
        error: tokenError.message,
        code: tokenError.code,
        details: tokenError.details,
      });
    }

    if (!tokenData || !tokenData.access_token) {
      logger.debug(`No Twitter tokens found for user: ${user.id}`, {
        hasTokenData: !!tokenData,
        hasAccessToken: !!tokenData?.access_token,
        tokenError: tokenError?.message,
        tokenErrorCode: tokenError?.code,
      });
      return NextResponse.json({ authenticated: false });
    }

    // If we have tokens, Twitter is connected (even if user_id isn't set yet)
    logger.debug(`Twitter tokens found for user: ${user.id}`, {
      hasUserId: !!tokenData.twitter_user_id,
      hasUsername: !!tokenData.twitter_username,
      tokenCreated: tokenData.created_at,
    });

    return NextResponse.json({
      authenticated: true,
      twitterUserId: tokenData.twitter_user_id || null,
      twitterUsername: tokenData.twitter_username || null,
      // Indicate if user info is still being fetched
      userInfoPending: !tokenData.twitter_user_id,
    });
  } catch (error) {
    logger.error("Error in Twitter status endpoint:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
