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

