import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DraftState } from "@/lib/types/pro-writer";

export async function POST(request: NextRequest) {
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

    const draft: DraftState = await request.json();

    // Validate required fields
    if (!draft.content || draft.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Save to Supabase
    const { data: draftData, error: draftError } = await supabase
      .from("drafts")
      .insert({
        user_id: user.id,
        content: draft.content,
        intent: draft.intent || null,
        relationships: draft.relationships || [],
        post_to_twitter: draft.postToTwitter,
        post_to_pro_feed: draft.postToProFeed,
        quality_checks: draft.qualityChecks || [],
        draft_maturity: draft.draftMaturity,
      })
      .select()
      .single();

    if (draftError) {
      throw new Error(`Failed to save draft: ${draftError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        draftId: draftData.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving draft:", error);
    return NextResponse.json(
      {
        error: "Failed to save draft",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

