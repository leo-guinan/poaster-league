import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postToTwitter } from "@/lib/twitter";
import { getUserTwitterAuth } from "@/lib/twitter-auth";
import { DraftState } from "@/lib/types/pro-writer";

export async function POST(request: NextRequest) {
  try {
    const draft: DraftState = await request.json();

    // Validate required fields
    if (!draft.content || draft.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    let twitterPostId: string | null = null;

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

    // Post to Twitter if requested
    if (draft.postToTwitter) {
      try {
        // Check if user has Twitter connected
        const auth = await getUserTwitterAuth(user.id);
        if (!auth) {
          return NextResponse.json(
            {
              error: "Twitter account not connected. Please connect your Twitter account to post.",
            },
            { status: 400 }
          );
        }

        twitterPostId = await postToTwitter(draft.content, user.id);
      } catch (error) {
        // Log error but don't fail the entire publish if Twitter fails
        console.error("Twitter post failed:", error);
        // You might want to still save the post but mark Twitter as failed
      }
    }

    // Save to Supabase (primary database)
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content: draft.content,
        intent: draft.intent || null,
        relationships: draft.relationships || [],
        post_to_twitter: draft.postToTwitter,
        post_to_pro_feed: draft.postToProFeed,
        twitter_post_id: twitterPostId,
        quality_checks: draft.qualityChecks || [],
        draft_maturity: draft.draftMaturity,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (postError) {
      throw new Error(`Failed to save post: ${postError.message}`);
    }


    return NextResponse.json(
      {
        success: true,
        postId: postData.id,
        twitterPostId: twitterPostId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error publishing post:", error);
    return NextResponse.json(
      {
        error: "Failed to publish post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

