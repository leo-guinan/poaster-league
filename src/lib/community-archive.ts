import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

let communityArchiveClient: ReturnType<typeof createClient> | null = null;

function getCommunityArchiveClient() {
  if (communityArchiveClient) {
    return communityArchiveClient;
  }

  const url = process.env.NEXT_PUBLIC_CA_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_CA_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Return null instead of throwing - allows graceful degradation
    return null;
  }

  communityArchiveClient = createClient(url, anonKey);
  return communityArchiveClient;
}

/**
 * Check if a Twitter user ID exists in the Community Archive
 * This determines automatic write access eligibility
 */
export async function checkCommunityArchiveEligibility(
  twitterUserId: string
): Promise<boolean> {
  try {
    const client = getCommunityArchiveClient();

    // If client is null, credentials aren't configured
    if (!client) {
      logger.warn("Community Archive not configured");
      return false;
    }

    // Try common table names for user data
    // Adjust based on actual Community Archive schema
    const possibleTables = ["users", "profiles", "archive", "members"];

    for (const tableName of possibleTables) {
      try {
        const { data, error } = await client
          .from(tableName)
          .select("id, twitter_user_id, twitter_id")
          .or(`twitter_user_id.eq.${twitterUserId},twitter_id.eq.${twitterUserId}`)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          logger.debug(`Found user in Community Archive table: ${tableName}`);
          return true;
        }
      } catch {
        // Table doesn't exist or wrong structure, try next
        continue;
      }
    }

    // If none of the common tables worked, try a direct query
    // This assumes there's a users table with twitter_user_id column
    const { data, error } = await client
      .from("users")
      .select("id")
      .eq("twitter_user_id", twitterUserId)
      .limit(1)
      .maybeSingle();

    if (error) {
      // Log but don't fail - might be schema mismatch
      logger.debug("Community Archive query failed:", error.message);
      return false;
    }

    const found = !!data;
    if (found) {
      logger.debug("User found in Community Archive");
    }
    return found;
  } catch (error) {
    logger.error("Error connecting to Community Archive:", error instanceof Error ? error.message : "Unknown error");
    // Fail gracefully - return false so manual review is required
    return false;
  }
}

/**
 * Get user details from Community Archive if they exist
 */
export async function getCommunityArchiveUser(twitterUserId: string) {
  try {
    const client = getCommunityArchiveClient();

    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("twitter_user_id", twitterUserId)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("Error fetching Community Archive user:", error.message);
      return null;
    }

    return data;
  } catch (error) {
    logger.error("Error connecting to Community Archive:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

