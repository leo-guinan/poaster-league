/**
 * Scout Mode Scanning Script
 * 
 * This script scans the Pro Feed for candidates matching scout profiles
 * and generates weekly reports. Should be run daily via cron.
 * 
 * Usage: pnpm tsx scripts/scout-scan.ts
 */

import { createClient } from "@supabase/supabase-js";
import { logger } from "../src/lib/logger";

// Type definitions for database rows
interface PostRow {
  id: number;
  user_id: string | null;
  content: string | null;
  intent: string | null;
  published_at: string | null;
  post_to_pro_feed: boolean | null;
}

interface UserRow {
  twitter_user_id: string | null;
}

interface ScoutReportRow {
  id: string;
  scout_profile_id: string;
  report_date: string;
  week_start: string;
  week_end: string;
  candidate_count: number;
}

// Scout intent to Pro Writer intent mapping
const SCOUT_TO_WRITER_INTENT_MAP: Record<string, string[]> = {
  propose: ["propose"],
  synthesize: ["synthesize"],
  critique: ["argue"],
  "seek-collaborators": ["invite", "propose"],
  teach: ["teach"],
  "build-in-public": ["signal", "explore"],
};

interface ScoutConfig {
  intentShapes?: string[];
  domain?: string;
  relationshipTarget?: string;
  sensitivity?: "emerging" | "established";
}

interface MatchCandidate {
  userId: string | null;
  twitterUserId: string | null;
  matchScore: number;
  matchConfidence: number;
  reasoning: string;
  samplePostIds: number[];
}

async function scanForCandidates(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  config: ScoutConfig
): Promise<MatchCandidate[]> {
  if (!config.intentShapes || config.intentShapes.length === 0) {
    return [];
  }

  // Map scout intents to writer intents
  const writerIntents: string[] = [];
  for (const scoutIntent of config.intentShapes) {
    const mapped = SCOUT_TO_WRITER_INTENT_MAP[scoutIntent] || [];
    writerIntents.push(...mapped);
  }
  const uniqueWriterIntents = [...new Set(writerIntents)];

  // Calculate date range based on sensitivity
  // Emerging: last 7 days (weak signals)
  // Established: last 30 days (consistent patterns)
  const daysToLookBack = config.sensitivity === "emerging" ? 7 : 30;
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - daysToLookBack);

  // Fetch posts matching intent patterns
  const query = supabase
    .from("posts")
    .select("id, user_id, content, intent, published_at, post_to_pro_feed")
    .eq("status", "published")
    .eq("post_to_pro_feed", true)
    .in("intent", uniqueWriterIntents)
    .gte("published_at", dateThreshold.toISOString())
    .order("published_at", { ascending: false });

  const { data: allPosts, error } = await query;

  if (error) {
    logger.error("Error fetching posts for scout scan:", error);
    return [];
  }

  if (!allPosts || allPosts.length === 0) {
    return [];
  }

  // Filter by domain if provided (basic keyword matching)
  // In production, you'd use semantic search or embeddings
  let posts: PostRow[] = (allPosts as unknown as PostRow[]) || [];
  if (config.domain && config.domain.trim()) {
    const domainTerms = config.domain.toLowerCase().split(/\s+/);
    posts = posts.filter((post) => {
      const content = post.content?.toLowerCase() || "";
      return domainTerms.some((term) => content.includes(term));
    });
  }

  if (!posts || posts.length === 0) {
    return [];
  }

  // Group posts by user
  const userPosts = new Map<string | null, PostRow[]>();
  posts.forEach((post) => {
    const userId = post.user_id;
    if (!userPosts.has(userId)) {
      userPosts.set(userId, []);
    }
    userPosts.get(userId)!.push(post);
  });

  // Score each user based on their posts
  const candidates: MatchCandidate[] = [];

  for (const [userId, userPostList] of userPosts.entries()) {
    if (!userId && userPostList.length === 0) continue;

    const postCount = userPostList.length;
    const recentPosts = userPostList.slice(0, 10); // Last 10 posts

    // Calculate match score based on:
    // 1. Post frequency (more posts = higher score for established, moderate for emerging)
    // 2. Intent diversity (matching multiple scout intents = higher score)
    // 3. Recency (more recent = higher score for emerging)

    let matchScore = 0;
    const intentMatches = new Set<string>();

    recentPosts.forEach((post) => {
      if (post.intent) {
        intentMatches.add(post.intent);
      }
      matchScore += 10; // Base score per post
    });

    // Bonus for intent diversity
    matchScore += intentMatches.size * 15;

    // Bonus for recency (emerging focus)
    if (config.sensitivity === "emerging") {
      const mostRecent = recentPosts[0];
      if (mostRecent && mostRecent.published_at) {
        const daysSincePost = Math.floor(
          (Date.now() - new Date(mostRecent.published_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysSincePost <= 3) {
          matchScore += 20; // Strong recent signal bonus
        }
      }
    }

    // Penalize low post count for established focus
    if (config.sensitivity === "established" && postCount < 3) {
      matchScore *= 0.7; // Penalty for low volume
    }

    // Calculate confidence (0-100)
    // Based on post count, recency, and consistency
    let confidence = Math.min(100, matchScore);
    
    // Adjust confidence based on sensitivity
    if (config.sensitivity === "emerging") {
      // Emerging favors lower thresholds
      confidence = Math.min(100, Math.max(30, confidence));
    } else {
      // Established favors higher thresholds
      confidence = Math.max(50, Math.min(100, confidence));
    }

    // Filter out low-confidence matches
    if (confidence < 40) {
      continue;
    }

    // Build reasoning
    const reasoningParts: string[] = [];
    if (postCount >= 3) {
      reasoningParts.push(`${postCount} matching posts`);
    } else {
      reasoningParts.push(`${postCount} matching post${postCount !== 1 ? "s" : ""}`);
    }
    
    if (intentMatches.size > 1) {
      reasoningParts.push(`Multiple intent patterns (${intentMatches.size})`);
    }

    if (config.sensitivity === "emerging" && recentPosts[0] && recentPosts[0].published_at) {
      const daysSincePost = Math.floor(
        (Date.now() - new Date(recentPosts[0].published_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSincePost <= 3) {
        reasoningParts.push("Recent activity");
      }
    }

    if (config.sensitivity === "established" && postCount >= 5) {
      reasoningParts.push("Consistent output");
    }

    // Get Twitter user ID if available
    let twitterUserId: string | null = null;
    if (userId) {
      const { data: user } = await supabase
        .from("users")
        .select("twitter_user_id")
        .eq("id", userId)
        .single();
      twitterUserId = (user as unknown as UserRow | null)?.twitter_user_id || null;
    }

    candidates.push({
      userId,
      twitterUserId,
      matchScore: Math.round(matchScore),
      matchConfidence: Math.round(confidence),
      reasoning: reasoningParts.join(", "),
      samplePostIds: recentPosts.slice(0, 5).map((p) => p.id),
    });
  }

  // Sort by confidence (highest first)
  candidates.sort((a, b) => b.matchConfidence - a.matchConfidence);

  // Limit results based on sensitivity
  // Emerging: up to 6 candidates (more exploratory)
  // Established: up to 4 candidates (higher bar)
  const maxCandidates = config.sensitivity === "emerging" ? 6 : 4;
  return candidates.slice(0, maxCandidates);
}

async function generateWeeklyReport(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  config: ScoutConfig
): Promise<void> {
  logger.info("Generating weekly report", { profileId });

  // Get week boundaries (Sunday to Saturday)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek); // Go to Sunday
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Saturday
  weekEnd.setHours(23, 59, 59, 999);

  // Check if report already exists for this week
  const reportDate = weekStart.toISOString().split("T")[0];
  const { data: existingReport } = await supabase
    .from("scout_reports")
    .select("id")
    .eq("scout_profile_id", profileId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (existingReport) {
    const report = existingReport as unknown as { id: string };
    logger.info("Report already exists for this week", { reportId: report.id });
    return;
  }

  // Scan for candidates
  const candidates = await scanForCandidates(supabase, profileId, config);

  if (candidates.length === 0) {
    logger.info("No candidates found for this week", { profileId });
    // Still create a report with 0 candidates
  }

  // Create report
  const { data: report, error: reportError } = await supabase
    .from("scout_reports")
    .insert({
      scout_profile_id: profileId,
      report_date: reportDate,
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      candidate_count: candidates.length,
    } as never)
    .select()
    .single();

  if (reportError || !report) {
    logger.error("Error creating scout report:", reportError);
    throw reportError || new Error("Failed to create report");
  }

  const reportData = report as unknown as ScoutReportRow;

  // Create candidate entries
  if (candidates.length > 0) {
    const candidateInserts = candidates.map((candidate) => ({
      scout_report_id: reportData.id,
      user_id: candidate.userId,
      twitter_user_id: candidate.twitterUserId,
      match_confidence: candidate.matchConfidence,
      reasoning: candidate.reasoning,
      sample_post_ids: candidate.samplePostIds,
    }));

    const { error: candidatesError } = await supabase
      .from("scout_report_candidates")
      .insert(candidateInserts as never);

    if (candidatesError) {
      logger.error("Error creating candidate entries:", candidatesError);
      throw candidatesError;
    }
  }

  logger.info("Weekly report generated", {
    reportId: reportData.id,
    candidateCount: candidates.length,
  });
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error("Missing Supabase environment variables");
    process.exit(1);
  }

  // Use service role key for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logger.info("Starting scout scan");

  // Get all active scout profiles
  const { data: profiles, error } = await supabase
    .from("scout_profiles")
    .select("id, user_id, config")
    .eq("active", true);

  if (error) {
    logger.error("Error fetching scout profiles:", error);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    logger.info("No active scout profiles found");
    return;
  }

  logger.info(`Found ${profiles.length} active scout profile(s)`);

  // Generate reports for each profile
  for (const profile of profiles) {
    try {
      await generateWeeklyReport(
        supabase as never,
        profile.id,
        profile.config as ScoutConfig
      );
    } catch (error) {
      logger.error("Error generating report for profile:", {
        profileId: profile.id,
        error,
      });
      // Continue with other profiles even if one fails
    }
  }

  logger.info("Scout scan completed");
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Fatal error in scout scan:", error);
      process.exit(1);
    });
}

export { main as scoutScan };

