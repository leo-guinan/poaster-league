import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";

interface AnnotationRequest {
  postId: number;
  content: string;
  intent?: IntentType;
  relationships?: RelationshipType[];
}

export async function POST(request: NextRequest) {
  try {
    const body: AnnotationRequest = await request.json();

    // Validate required fields
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

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

    // Upsert annotation (create or update if exists)
    const { data: annotationData, error: annotationError } = await supabase
      .from("annotations")
      .upsert(
        {
          user_id: user.id,
          post_id: body.postId,
          content: body.content.trim(),
          intent: body.intent || null,
          relationships: body.relationships || [],
        },
        {
          onConflict: "user_id,post_id",
        }
      )
      .select()
      .single();

    if (annotationError) {
      logger.error("Error saving annotation:", annotationError);
      throw new Error(`Failed to save annotation: ${annotationError.message}`);
    }

    logger.info("Annotation saved successfully", {
      annotationId: annotationData.id,
      postId: body.postId,
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        annotationId: annotationData.id,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Error creating annotation:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error: "Failed to create annotation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET annotation for a specific post
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

    // Get annotation for this user and post
    const { data: annotation, error: annotationError } = await supabase
      .from("annotations")
      .select("*")
      .eq("user_id", user.id)
      .eq("post_id", parseInt(postId))
      .maybeSingle();

    if (annotationError) {
      logger.error("Error fetching annotation:", annotationError);
      throw new Error(`Failed to fetch annotation: ${annotationError.message}`);
    }

    return NextResponse.json(
      {
        annotation: annotation || null,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Error fetching annotation:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error: "Failed to fetch annotation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

