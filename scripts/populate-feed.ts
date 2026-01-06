/**
 * Populate Feed Script
 * 
 * Fetches tweets from the last 24 hours from Community Archive accounts
 * and creates posts in the Poaster League database.
 * 
 * Usage:
 *   pnpm populate-feed
 *   or
 *   pnpm tsx scripts/populate-feed.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { join } from "path";

// Load environment variables
dotenv.config({ path: join(process.cwd(), ".env.local") });

// Initialize clients
// Use service role key to bypass RLS policies for script operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error("⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set. Using anon key may cause RLS policy violations.");
}

const mainSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const communityArchiveSupabase = createClient(
  process.env.NEXT_PUBLIC_CA_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_CA_SUPABASE_ANON_KEY!
);

interface CommunityArchiveAccount {
  account_id: string; // Twitter user ID
  username?: string; // Twitter handle
}

interface CommunityArchiveTweet {
  id?: string | null;
  tweet_id?: string | null;
  account_id: string;
  text?: string | null;
  content?: string | null;
  created_at?: string | null;
  tweet_created_at?: string | null;
  _raw?: Record<string, unknown>; // For debugging
}

/**
 * Get all accounts from Community Archive
 * Uses the 'account' table which has account_id (Twitter user ID) and username
 */
async function getCommunityArchiveAccounts(): Promise<CommunityArchiveAccount[]> {
  console.log("Fetching accounts from Community Archive...");

  try {
    const { data, error } = await communityArchiveSupabase
      .schema("public")
      .from("account")
      .select("account_id, username");

    if (error) {
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.warn("No accounts found in Community Archive");
      return [];
    }

    console.log(`✓ Found ${data.length} accounts in Community Archive`);
    return data.map((account) => ({
      account_id: account.account_id,
      username: account.username,
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Error fetching Community Archive accounts: ${errorMsg}`);
  }
}

/**
 * Fetch tweets from Community Archive for a specific account in the last 24 hours
 * Uses the 'tweets' table which has account_id and tweet data
 */
async function fetchAccountTweets(
  accountId: string,
  username?: string
): Promise<CommunityArchiveTweet[]> {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  const startTime = twentyFourHoursAgo.toISOString();

  try {
    // Query tweets from the last 24 hours for this account
    // The tweets table has account_id and created_at columns
    const { data, error } = await communityArchiveSupabase
      .schema("public")
      .from("tweets")
      .select("*")
      .eq("account_id", accountId)
      .gte("created_at", startTime)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch tweets: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Log first tweet structure to debug column names (only once)
    const globalObj = global as { __loggedTweetStructure?: boolean };
    if (data.length > 0 && !globalObj.__loggedTweetStructure) {
      console.log("  🔍 Sample tweet columns:", Object.keys(data[0] as Record<string, unknown>).join(", "));
      globalObj.__loggedTweetStructure = true;
    }

    return data.map((tweet: Record<string, unknown>) => {
      // Try multiple possible column names for tweet text
      const tweetText = 
        (tweet.text as string | undefined) || 
        (tweet.content as string | undefined) || 
        (tweet.tweet_text as string | undefined) || 
        (tweet.full_text as string | undefined) || 
        (tweet.body as string | undefined) || 
        (tweet.message as string | undefined) ||
        (tweet.tweet_content as string | undefined) ||
        null;

      // Try multiple possible column names for tweet ID
      const tweetId = 
        (tweet.tweet_id as string | undefined) || 
        (tweet.id as string | undefined) || 
        (tweet.tweetId as string | undefined) ||
        null;

      // Try multiple possible column names for created_at
      const createdAt = 
        (tweet.created_at as string | undefined) || 
        (tweet.tweet_created_at as string | undefined) || 
        (tweet.createdAt as string | undefined) ||
        (tweet.tweetCreatedAt as string | undefined) ||
        null;

      const result: CommunityArchiveTweet = {
        id: tweetId,
        tweet_id: tweetId,
        account_id: (tweet.account_id as string | undefined) || (tweet.accountId as string | undefined) || "",
        text: tweetText,
        content: tweetText,
        created_at: createdAt,
        tweet_created_at: createdAt,
        // Store raw tweet for debugging
        _raw: tweet,
      };
      return result;
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Error fetching tweets for ${username || accountId}:`,
      errorMessage
    );
    return [];
  }
}

/**
 * Get user ID from the main database if they exist
 * Also creates placeholder accounts for accounts that don't exist yet
 */
async function getOrCreateUser(
  accountId: string, // Twitter user ID (account_id from Community Archive)
  twitterHandle?: string,
  name?: string
): Promise<string | null> {
  // Check if user already exists (using twitter_user_id which matches account_id)
  const { data: existingUser } = await mainSupabase
    .from("users")
    .select("id")
    .eq("twitter_user_id", accountId)
    .maybeSingle();

  if (existingUser) {
    return existingUser.id;
  }

  // Check if placeholder account exists
  const { data: existingPlaceholder } = await mainSupabase
    .from("placeholder_accounts")
    .select("id, claimed_by")
    .eq("twitter_user_id", accountId)
    .maybeSingle();

  if (existingPlaceholder) {
    // If placeholder is claimed, return the user ID
    if (existingPlaceholder.claimed_by) {
      return existingPlaceholder.claimed_by;
    }
    // Placeholder exists but not claimed yet
    return null;
  }

  // Upsert placeholder account (insert or update if exists)
  const { error } = await mainSupabase
    .from("placeholder_accounts")
    .upsert({
      twitter_user_id: accountId,
      handle: twitterHandle,
      name: name,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "twitter_user_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error(`Error upserting placeholder for ${twitterHandle || accountId}:`, error.message);
    return null;
  }

  console.log(`  📝 Created/updated placeholder account for @${twitterHandle || accountId}`);
  return null; // Not claimed yet
}


/**
 * Create or update a post from a Community Archive tweet
 * Returns: 'created' | 'updated' | false
 */
async function createPostFromTweet(
  tweet: CommunityArchiveTweet,
  userId: string | null
): Promise<'created' | 'updated' | false> {
  const tweetId = tweet.tweet_id || tweet.id;
  if (!tweetId) {
    console.error(`  ⚠️  Tweet missing ID, skipping`);
    return false;
  }

  const tweetText = tweet.text || tweet.content;
  if (!tweetText) {
    // Log the raw tweet structure to help debug
    if ('_raw' in tweet && tweet._raw) {
      const rawTweet = tweet._raw as Record<string, unknown>;
      console.error(`  ⚠️  Tweet ${tweetId} missing text. Available keys:`, Object.keys(rawTweet).join(", "));
    } else {
      console.error(`  ⚠️  Tweet ${tweetId} missing text, skipping`);
    }
    return false;
  }

  // Basic quality checks (can be enhanced)
  const qualityChecks = [
    {
      id: "clarity",
      status: "pass" as const,
      message: "Imported from Community Archive",
    },
  ];

  const publishedAt = tweet.created_at || tweet.tweet_created_at || new Date().toISOString();

  // Upsert post (insert or update if exists)
  // Use twitter_post_id as the unique identifier
  const { data: existingPost } = await mainSupabase
    .from("posts")
    .select("id")
    .eq("twitter_post_id", tweetId)
    .maybeSingle();

  if (existingPost) {
    // Update existing post
    const { error } = await mainSupabase
      .from("posts")
      .update({
        user_id: userId, // Update user_id in case placeholder was claimed
        content: tweetText,
        updated_at: new Date().toISOString(),
        // Don't update published_at to preserve original timestamp
      })
      .eq("id", existingPost.id);

    if (error) {
      console.error(`  ❌ Error updating post for tweet ${tweetId}:`, error.message);
      return false;
    }
    return 'updated';
  } else {
    // Insert new post
    const { error } = await mainSupabase.from("posts").insert({
      user_id: userId,
      content: tweetText,
      intent: null, // Can be analyzed later
      relationships: [],
      post_to_twitter: false, // Already posted
      post_to_pro_feed: true,
      twitter_post_id: tweetId,
      quality_checks: qualityChecks,
      draft_maturity: 1, // Basic maturity for imported posts
      status: "published",
      published_at: publishedAt,
    });

    if (error) {
      console.error(`  ❌ Error creating post for tweet ${tweetId}:`, error.message);
      return false;
    } else {
      console.log(`  ✓ Created: ${tweetText.substring(0, 60)}...`);
      return 'created';
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Starting feed population...\n");

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_CA_SUPABASE_URL || !process.env.NEXT_PUBLIC_CA_SUPABASE_ANON_KEY) {
    console.error("❌ Missing Community Archive credentials!");
    console.error("   Set NEXT_PUBLIC_CA_SUPABASE_URL and NEXT_PUBLIC_CA_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  try {
    // Get all Community Archive accounts
    const accounts = await getCommunityArchiveAccounts();

    if (accounts.length === 0) {
      console.log("No accounts found in Community Archive. Exiting.");
      return;
    }

    console.log(`\n📊 Processing ${accounts.length} accounts...\n`);

    // First, create placeholder accounts for all Community Archive accounts
    console.log("Creating placeholder accounts...\n");
    let placeholderCount = 0;
    for (const account of accounts) {
      if (!account.account_id) {
        continue;
      }

      // Get profile info if available
      const { data: profile } = await communityArchiveSupabase
        .schema("public")
        .from("profile")
        .select("name, avatar_url")
        .eq("account_id", account.account_id)
        .maybeSingle();

      // Upsert placeholder account (insert or update if exists)
      const { error } = await mainSupabase
        .from("placeholder_accounts")
        .upsert({
          twitter_user_id: account.account_id,
          handle: account.username,
          name: profile?.name || null,
          avatar_url: profile?.avatar_url || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "twitter_user_id",
          ignoreDuplicates: false,
        });

      if (!error) {
        placeholderCount++;
      } else {
        console.error(`  ⚠️  Error upserting placeholder for @${account.username}:`, error.message);
      }
    }
    console.log(`✓ Created/updated ${placeholderCount} placeholder accounts\n`);

    let totalTweets = 0;
    let totalPosts = 0;

    // Process each account
    for (const account of accounts) {
      if (!account.account_id) {
        continue;
      }

      console.log(`\n👤 Processing @${account.username || account.account_id}...`);

      // Fetch tweets from Community Archive for last 24 hours
      const tweets = await fetchAccountTweets(account.account_id, account.username);

      if (tweets.length === 0) {
        console.log(`  No tweets found in last 24 hours`);
        continue;
      }

      console.log(`  Found ${tweets.length} tweets`);

      // Get user ID from main database (if they exist)
      const userId = await getOrCreateUser(
        account.account_id,
        account.username
      );

      if (!userId) {
        console.log(`  📝 Placeholder account exists (will be claimed when user joins)`);
      }

      // Create/update posts from tweets (userId can be null for imported posts)
      let createdCount = 0;
      let updatedCount = 0;
      for (const tweet of tweets) {
        const result = await createPostFromTweet(tweet, userId);
        if (result === 'created') {
          createdCount++;
          totalPosts++;
        } else if (result === 'updated') {
          updatedCount++;
        }
        totalTweets++;
      }

      if (createdCount > 0) {
        console.log(`  ✓ Created ${createdCount} new posts`);
      }
      if (updatedCount > 0) {
        console.log(`  🔄 Updated ${updatedCount} existing posts`);
      }
      if (createdCount === 0 && updatedCount === 0 && tweets.length > 0) {
        console.log(`  ⊘ All ${tweets.length} tweets already up to date`);
      }

      // Small delay to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Feed population complete!`);
    console.log(`   Processed ${accounts.length} accounts`);
    console.log(`   Created ${placeholderCount} placeholder accounts`);
    console.log(`   Fetched ${totalTweets} tweets`);
    console.log(`   Created ${totalPosts} posts`);
  } catch (error) {
    console.error("\n❌ Error populating feed:", error);
    process.exit(1);
  }
}

// Run the script
main();
