import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { ScoutConfig } from "@/lib/types/user";

// Map Scout intents to Pro Writer intents for matching
const SCOUT_TO_WRITER_INTENT_MAP: Record<string, string[]> = {
  propose: ["propose"],
  synthesize: ["synthesize"],
  critique: ["argue"], // Critique maps to argue in the writer system
  "seek-collaborators": ["invite", "propose"], // Seeking collaborators often uses invite or propose
  teach: ["teach"],
  "build-in-public": ["signal", "explore"], // Building in public often signals or explores
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const config: Partial<ScoutConfig> = await request.json();

    if (!config.intentShapes || config.intentShapes.length === 0) {
      return NextResponse.json(
        { error: "Intent shapes required for preview" },
        { status: 400 }
      );
    }

    // Map scout intents to writer intents
    const writerIntents: string[] = [];
    for (const scoutIntent of config.intentShapes) {
      const mapped = SCOUT_TO_WRITER_INTENT_MAP[scoutIntent] || [];
      writerIntents.push(...mapped);
    }
    const uniqueWriterIntents = [...new Set(writerIntents)];

    // Calculate date range (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query posts from last 30 days matching intent patterns
    const query = supabase
      .from("posts")
      .select("user_id, intent")
      .eq("status", "published")
      .gte("published_at", thirtyDaysAgo.toISOString())
      .in("intent", uniqueWriterIntents);

    // If domain is provided, we'd filter by content matching
    // For now, we'll do a simple text search in content
    // In production, you'd use semantic search or better matching

    const { data: posts, error } = await query;

    if (error) {
      logger.error("Error fetching preview data:", error);
      throw error;
    }

    // Group by user_id to count unique authors
    const userPostCounts = new Map<string, number>();
    posts?.forEach((post) => {
      if (post.user_id) {
        userPostCounts.set(
          post.user_id,
          (userPostCounts.get(post.user_id) || 0) + 1
        );
      }
    });

    // Estimate monthly candidates
    // Assume 30 days = 1 month, so this is our estimate
    const uniqueAuthors = userPostCounts.size;

    // Rough estimate: multiply by 1 to get monthly (since we already have 30 days)
    // Then divide by sensitivity factor
    const sensitivityMultiplier =
      config.sensitivity === "established" ? 0.6 : 1.2; // Emerging finds more
    const monthlyEstimate = Math.round(uniqueAuthors * sensitivityMultiplier);

    // Estimate strong vs medium matches
    // Strong = authors with 3+ posts, medium = 1-2 posts
    let strongMatches = 0;
    let mediumMatches = 0;

    userPostCounts.forEach((count) => {
      if (count >= 3) {
        strongMatches++;
      } else {
        mediumMatches++;
      }
    });

    // Apply sensitivity filter to estimates
    if (config.sensitivity === "established") {
      strongMatches = Math.round(strongMatches * 1.2);
      mediumMatches = Math.round(mediumMatches * 0.8);
    } else {
      strongMatches = Math.round(strongMatches * 0.8);
      mediumMatches = Math.round(mediumMatches * 1.2);
    }

    return NextResponse.json({
      monthlyEstimate: Math.max(1, monthlyEstimate), // At least 1
      strongMatches: Math.max(0, strongMatches),
      mediumMatches: Math.max(0, mediumMatches),
    });
  } catch (error) {
    logger.error("Error in scout preview:", error);
    return NextResponse.json(
      {
        error: "Failed to generate preview",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

