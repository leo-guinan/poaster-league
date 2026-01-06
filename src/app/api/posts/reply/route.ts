import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { replyToTwitter } from "@/lib/twitter";
import { getUserTwitterAuth } from "@/lib/twitter-auth";
import { logger } from "@/lib/logger";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";

interface ReplyRequest {
  content: string;
  parentPostId: number;
  intent?: IntentType;
  relationships?: RelationshipType[];
  postToTwitter?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReplyRequest = await request.json();

    // Validate required fields
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (!body.parentPostId) {
      return NextResponse.json(
        { error: "Parent post ID is required" },
        { status: 400 }
      );
    }

    // Get authenticated user
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

    // Verify write permission
    const { data: userProfile } = await supabase
      .from("users")
      .select("write_permission, twitter_user_id")
      .eq("id", user.id)
      .single();

    if (!userProfile?.write_permission) {
      return NextResponse.json(
        { error: "Write access required. Please request access first." },
        { status: 403 }
      );
    }

    // Get parent post to check if it has a Twitter post ID
    const { data: parentPost, error: parentError } = await supabase
      .from("posts")
      .select("id, twitter_post_id, user_id")
      .eq("id", body.parentPostId)
      .single();

    if (parentError || !parentPost) {
      return NextResponse.json(
        { error: "Parent post not found" },
        { status: 404 }
      );
    }

    let twitterReplyId: string | null = null;
    let twitterError: string | null = null;

    // Post reply to Twitter if requested and parent has a Twitter post ID
    if (body.postToTwitter && parentPost.twitter_post_id) {
      try {
        logger.info("Attempting to post reply to Twitter", {
          parentTwitterPostId: parentPost.twitter_post_id,
          userId: user.id,
        });

        // Check if user has Twitter connected
        const auth = await getUserTwitterAuth(user.id);
        if (!auth) {
          twitterError = "Twitter account not connected";
          logger.warn("Twitter reply skipped: user not connected", { userId: user.id });
        } else {
          twitterReplyId = await replyToTwitter(
            body.content,
            parentPost.twitter_post_id,
            user.id
          );
          logger.info("Twitter reply posted successfully", {
            twitterReplyId,
            parentTwitterPostId: parentPost.twitter_post_id,
          });
        }
      } catch (error) {
        twitterError = error instanceof Error ? error.message : "Unknown error";
        logger.error("Twitter reply failed:", {
          error: twitterError,
          parentTwitterPostId: parentPost.twitter_post_id,
          userId: user.id,
        });
        // Continue - save the reply in the app even if Twitter fails
      }
    } else {
      logger.debug("Twitter reply skipped", {
        postToTwitter: body.postToTwitter,
        hasParentTwitterId: !!parentPost.twitter_post_id,
      });
    }

    // Save reply to Supabase (always save, even if Twitter fails)
    // Replies are anonymous in the app (user_id can be null or set to null)
    const { data: replyData, error: replyError } = await supabase
      .from("posts")
      .insert({
        user_id: null, // Anonymous replies in the app
        parent_post_id: body.parentPostId,
        content: body.content,
        intent: body.intent || null,
        relationships: body.relationships || [],
        post_to_twitter: body.postToTwitter || false,
        post_to_pro_feed: true, // Replies always show in feed
        twitter_post_id: twitterReplyId,
        twitter_reply_to_id: parentPost.twitter_post_id || null,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (replyError) {
      logger.error("Error saving reply:", replyError);
      throw new Error(`Failed to save reply: ${replyError.message}`);
    }

    logger.info("Reply posted successfully", {
      replyId: replyData.id,
      parentPostId: body.parentPostId,
      twitterReplyId,
      twitterError,
    });

    return NextResponse.json(
      {
        success: true,
        replyId: replyData.id,
        twitterReplyId: twitterReplyId,
        twitterError: twitterError || undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Error posting reply:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error: "Failed to post reply",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

