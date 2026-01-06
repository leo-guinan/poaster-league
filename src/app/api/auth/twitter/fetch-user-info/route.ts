import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TwitterApi } from "twitter-api-v2";
import { getUserTwitterAuth } from "@/lib/twitter-auth";
import { logger } from "@/lib/logger";

/**
 * API endpoint to fetch Twitter user info on-demand
 * This is called when tokens exist but user info wasn't fetched due to rate limits
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get Twitter auth (includes tokens)
    const auth = await getUserTwitterAuth(user.id);

    if (!auth) {
      return NextResponse.json(
        { error: "Twitter not connected" },
        { status: 400 }
      );
    }

    // If we already have user info, return it
    if (auth.twitterUserId && auth.twitterUsername) {
      return NextResponse.json({
        success: true,
        twitterUserId: auth.twitterUserId,
        twitterUsername: auth.twitterUsername,
        message: "User info already available",
      });
    }

    // Try to fetch user info from Twitter API
    try {
      const twitterClient = new TwitterApi(auth.accessToken);
      const userInfo = await twitterClient.v2.me();

      // Update tokens with user info
      await supabase
        .from("twitter_tokens")
        .update({
          twitter_user_id: userInfo.data.id,
          twitter_username: userInfo.data.username || null,
        })
        .eq("user_id", user.id);

      // Check Community Archive eligibility and auto-grant write access if eligible
      const { checkCommunityArchiveEligibility } = await import("@/lib/user-state");
      const isEligible = await checkCommunityArchiveEligibility(userInfo.data.id);
      
      // Update user profile
      await supabase
        .from("users")
        .update({
          twitter_user_id: userInfo.data.id,
          handle: userInfo.data.username || null,
          name: userInfo.data.name || null,
          avatar_url: userInfo.data.profile_image_url || null,
          twitter_verified: true,
          write_permission: isEligible, // Auto-grant if in Community Archive
        })
        .eq("id", user.id);
      
      if (isEligible) {
        logger.info("User found in Community Archive, write access automatically granted", {
          userId: user.id,
          twitterUserId: userInfo.data.id,
        });
      }

      logger.info("Twitter user info fetched successfully", {
        userId: user.id,
        twitterUserId: userInfo.data.id,
        username: userInfo.data.username,
      });

      return NextResponse.json({
        success: true,
        twitterUserId: userInfo.data.id,
        twitterUsername: userInfo.data.username,
        name: userInfo.data.name,
        profileImageUrl: userInfo.data.profile_image_url,
      });
    } catch (error: unknown) {
      const errorObj = error as { code?: string; status?: number; message?: string };
      const errorCode = errorObj.code || errorObj.status?.toString();

      if (errorCode === "429" || errorObj.status === 429) {
        logger.warn("Twitter API still rate limited when fetching user info", {
          userId: user.id,
        });
        return NextResponse.json(
          {
            error: "Twitter API rate limit exceeded. Please try again in a few minutes.",
            code: "rate_limited",
          },
          { status: 429 }
        );
      }

      logger.error("Failed to fetch Twitter user info:", {
        userId: user.id,
        code: errorCode,
        message: errorObj.message,
      });

      return NextResponse.json(
        {
          error: "Failed to fetch Twitter user info",
          details: errorObj.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Error in fetch-user-info endpoint:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

