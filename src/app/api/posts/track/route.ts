import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface TrackRequest {
  postId: number;
  tracked: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: TrackRequest = await request.json();

    if (!body.postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
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

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", body.postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    if (body.tracked) {
      // Add tracking
      const { error: trackingError } = await supabase
        .from("post_tracking")
        .insert({
          user_id: user.id,
          post_id: body.postId,
        });

      if (trackingError) {
        // If it's a unique constraint violation, it's already tracked - that's fine
        if (trackingError.code !== "23505") {
          logger.error("Error tracking post:", trackingError);
          throw new Error(`Failed to track post: ${trackingError.message}`);
        }
      }

      logger.info("Post tracked successfully", {
        postId: body.postId,
        userId: user.id,
      });
    } else {
      // Remove tracking
      const { error: deleteError } = await supabase
        .from("post_tracking")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", body.postId);

      if (deleteError) {
        logger.error("Error untracking post:", deleteError);
        throw new Error(`Failed to untrack post: ${deleteError.message}`);
      }

      logger.info("Post untracked successfully", {
        postId: body.postId,
        userId: user.id,
      });
    }

    return NextResponse.json(
      {
        success: true,
        tracked: body.tracked,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Error toggling track:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error: "Failed to toggle track",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET tracking status for a specific post
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID is required" },
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

    // Check if post is tracked
    const { data: tracking, error: trackingError } = await supabase
      .from("post_tracking")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", parseInt(postId))
      .maybeSingle();

    if (trackingError) {
      logger.error("Error checking tracking status:", trackingError);
      throw new Error(`Failed to check tracking status: ${trackingError.message}`);
    }

    return NextResponse.json(
      {
        tracked: !!tracking,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Error fetching tracking status:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error: "Failed to fetch tracking status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

