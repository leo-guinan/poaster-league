import { TwitterApi } from "twitter-api-v2";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import crypto from "crypto";

export function generateCodeVerifier(): string {
  // Generate a cryptographically random string using the recommended method
  // Must be 43-128 characters, URL-safe
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  // Generate code challenge using S256 method (SHA256)
  // The verifier must be hashed exactly as it was when generating the auth URL
  const hash = crypto.createHash("sha256");
  hash.update(verifier);
  return hash.digest("base64url");
}

export function getTwitterOAuthClient() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Twitter OAuth credentials not configured");
  }

  return new TwitterApi({
    clientId,
    clientSecret,
  });
}

export async function getAuthUrl(_userId: string): Promise<{ // eslint-disable-line @typescript-eslint/no-unused-vars
  url: string;
  codeVerifier: string;
  state: string;
}> {
  const client = getTwitterOAuthClient();
  const codeVerifier = generateCodeVerifier();
  const state = crypto.randomBytes(16).toString("hex");

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  
  // The twitter-api-v2 library generates the code verifier and state internally
  // We pass our own codeVerifier and state, and the library will use them
  const { url, codeVerifier: returnedCodeVerifier, state: returnedState } = await client.generateOAuth2AuthLink(
    `${baseUrl}/api/auth/twitter/callback`,
    {
      scope: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      codeVerifier,
      state,
    } as Parameters<typeof client.generateOAuth2AuthLink>[1] & { codeVerifier: string; state: string }
  );

  // Use the code verifier returned by the library, or fall back to our generated one
  const finalCodeVerifier = returnedCodeVerifier || codeVerifier;
  const finalState = returnedState || state;

  return { url, codeVerifier: finalCodeVerifier, state: finalState };
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  state: string,
  userId: string,
  baseUrl?: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}> {
  const client = getTwitterOAuthClient();

  const redirectUri = baseUrl 
    ? `${baseUrl}/api/auth/twitter/callback`
    : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/twitter/callback`;

  let accessToken: string;
  let refreshToken: string | undefined;
  let expiresIn: number | undefined;

  try {
    const result = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri,
    });
    accessToken = result.accessToken;
    refreshToken = result.refreshToken;
    expiresIn = result.expiresIn;
  } catch (error: unknown) {
    // Log error without exposing sensitive details
    const errorObj = error as { code?: string; message?: string };
    logger.error("Twitter OAuth2 login failed:", {
      code: errorObj.code,
      message: errorObj.message,
      // Don't log redirectUri, codeVerifier, or code in production
    });
    throw error;
  }

  // Get user info
  const userClient = new TwitterApi(accessToken);
  const user = await userClient.v2.me();

  // Calculate expiration
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Store or update auth in Supabase
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("twitter_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("twitter_tokens")
      .update({
        access_token: accessToken,
        refresh_token: refreshToken || null,
        expires_at: expiresAt,
        twitter_user_id: user.data.id,
        twitter_username: user.data.username || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await supabase.from("twitter_tokens").insert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: expiresAt,
      twitter_user_id: user.data.id,
      twitter_username: user.data.username || null,
    });
  }

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Refresh an expired Twitter access token using the refresh token
 */
export async function refreshTwitterToken(userId: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
} | null> {
  const supabase = await createClient();
  
  // Get current token data
  const { data: tokenData } = await supabase
    .from("twitter_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenData?.refresh_token) {
    logger.debug("No refresh token available for user");
    return null;
  }

  const client = getTwitterOAuthClient();

  try {
    // Refresh the token
    const result = await client.refreshOAuth2Token(tokenData.refresh_token);
    
    const newAccessToken = result.accessToken;
    const newRefreshToken = result.refreshToken || tokenData.refresh_token; // Keep old if not provided
    const expiresAt = result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
      : null;

    // Update in Supabase
    await supabase
      .from("twitter_tokens")
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: result.expiresIn,
    };
  } catch (error) {
    logger.error("Error refreshing Twitter token:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

export async function getUserTwitterAuth(
  userId: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  twitterUserId: string | null;
  twitterUsername: string | null;
} | null> {
  const supabase = await createClient();
  
  const { data: tokenData, error } = await supabase
    .from("twitter_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenData) {
    return null;
  }

  // Check if token is expired
  if (tokenData.expires_at) {
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    
    // If expired or expires within 5 minutes, try to refresh
    if (expiresAt <= now || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      logger.debug("Token expired or expiring soon, attempting refresh");
      const refreshed = await refreshTwitterToken(userId);
      
      if (refreshed) {
        // Return the refreshed token data
        const { data: updatedToken } = await supabase
          .from("twitter_tokens")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (updatedToken) {
          return {
            accessToken: updatedToken.access_token,
            refreshToken: updatedToken.refresh_token,
            twitterUserId: updatedToken.twitter_user_id,
            twitterUsername: updatedToken.twitter_username,
          };
        }
      }
      
      // If refresh failed, return null
      return null;
    }
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    twitterUserId: tokenData.twitter_user_id,
    twitterUsername: tokenData.twitter_username,
  };
}

export async function revokeTwitterAuth(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("twitter_tokens").delete().eq("user_id", userId);
}

export async function getTwitterClientForUser(
  userId: string
): Promise<TwitterApi | null> {
  const auth = await getUserTwitterAuth(userId);
  if (!auth) {
    logger.debug("No Twitter auth found for user");
    return null;
  }

  // For OAuth 2.0 user context, we can use the access token directly
  // The TwitterApi constructor accepts an access token string for OAuth 2.0
  try {
    const client = new TwitterApi(auth.accessToken);
    
    // Verify the token works by making a test call
    // (We'll catch errors in the calling function)
    return client;
  } catch (error) {
    logger.error("Error creating Twitter client:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}
