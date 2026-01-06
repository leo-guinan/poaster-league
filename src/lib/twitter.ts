import { TwitterApi } from "twitter-api-v2";
import { getTwitterClientForUser } from "./twitter-auth";
import { logger } from "./logger";

// Initialize Twitter client using OAuth 2.0
// First tries to use user's authenticated token, falls back to env vars
async function getTwitterClient(userId?: string): Promise<TwitterApi> {
  // Option 1: Try to use user's authenticated token
  if (userId) {
    const userClient = await getTwitterClientForUser(userId);
    if (userClient) {
      return userClient;
    }
  }

  // Option 2: Fall back to environment variables (for backward compatibility)
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;

  if (accessToken) {
    // For OAuth 2.0, use access token directly
    return new TwitterApi(accessToken);
  }

  // Option 3: Use Bearer Token (App-only, but can work if granted write permissions)
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (bearerToken) {
    return new TwitterApi(bearerToken);
  }

  throw new Error(
    "Twitter API credentials are not configured. Please connect your Twitter account or set environment variables."
  );
}

export async function postToTwitter(
  content: string,
  userId?: string
): Promise<string> {
  try {
    const client = await getTwitterClient(userId);
    
    logger.debug("Posting to Twitter");
    
    const tweet = await client.v2.tweet(content);
    return tweet.data.id;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    logger.error("Error posting to Twitter:", {
      code: errorObj.code,
      message: errorObj.message,
      // Don't log userId or sensitive data
    });
    throw new Error(
      `Failed to post to Twitter: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Reply to a tweet on Twitter
 * @param content - The reply content
 * @param replyToTweetId - The ID of the tweet to reply to
 * @param userId - Optional user ID for authenticated posting
 * @returns The ID of the created reply tweet
 */
export async function replyToTwitter(
  content: string,
  replyToTweetId: string,
  userId?: string
): Promise<string> {
  try {
    const client = await getTwitterClient(userId);
    
    logger.debug("Replying to Twitter tweet", {
      replyToTweetId,
    });
    
    // Use the reply parameter to reply to a specific tweet
    // Twitter API v2 uses reply.in_reply_to_tweet_id
    // The twitter-api-v2 library expects the reply object with in_reply_to_tweet_id
    const reply = await client.v2.tweet({
      text: content,
      reply: {
        in_reply_to_tweet_id: replyToTweetId,
      },
    });
    
    return reply.data.id;
  } catch (error: unknown) {
    const errorObj = error as { code?: string; message?: string };
    logger.error("Error replying to Twitter:", {
      code: errorObj.code,
      message: errorObj.message,
      replyToTweetId,
    });
    throw new Error(
      `Failed to reply to Twitter: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export function isTwitterConfigured(): boolean {
  // Check for OAuth 2.0 credentials (Client ID + Client Secret + Access Token)
  const hasOAuth2 =
    process.env.TWITTER_CLIENT_ID &&
    process.env.TWITTER_CLIENT_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN;

  // Or check for Bearer Token
  const hasBearerToken = process.env.TWITTER_BEARER_TOKEN;

  return !!(hasOAuth2 || hasBearerToken);
}

