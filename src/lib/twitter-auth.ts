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
  baseUrl?: string,
  supabaseClient?: Awaited<ReturnType<typeof createClient>>
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  twitterUser?: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
  };
}> {
  const client = getTwitterOAuthClient();

  const redirectUri = baseUrl 
    ? `${baseUrl}/api/auth/twitter/callback`
    : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/twitter/callback`;

  let accessToken: string;
  let refreshToken: string | undefined;
  let expiresIn: number | undefined;

  try {
    logger.debug("Calling Twitter OAuth2 token exchange endpoint", {
      redirectUri,
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
      timestamp: new Date().toISOString(),
    });
    
    const result = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri,
    });
    
    logger.debug("Twitter OAuth2 token exchange successful", {
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken,
      expiresIn: result.expiresIn,
    });
    
    accessToken = result.accessToken;
    refreshToken = result.refreshToken;
    expiresIn = result.expiresIn;
  } catch (error: unknown) {
    // Log error with more details for debugging
    const errorObj = error as { 
      code?: string; 
      message?: string; 
      status?: number; 
      rateLimit?: unknown;
      headers?: Record<string, string>;
      data?: unknown;
    };
    const errorMessage = errorObj.message || "Unknown error";
    const errorCode = errorObj.code || errorObj.status?.toString();
    
    // Extract rate limit info from headers if available
    const rateLimitInfo = errorObj.headers ? {
      limit: errorObj.headers["x-rate-limit-limit"],
      remaining: errorObj.headers["x-rate-limit-remaining"],
      reset: errorObj.headers["x-rate-limit-reset"],
    } : null;
    
    // Handle rate limiting (429) specifically
    if (errorCode === "429" || errorObj.status === 429) {
      logger.error("Twitter OAuth2 rate limited (429):", {
        code: errorCode,
        message: errorMessage,
        rateLimit: errorObj.rateLimit,
        rateLimitHeaders: rateLimitInfo,
        fullError: errorObj.data,
        timestamp: new Date().toISOString(),
      });
      throw new Error("Twitter API rate limit exceeded. Please wait a few minutes and try again.");
    }
    
    // Log other errors
    logger.error("Twitter OAuth2 login failed:", {
      code: errorCode,
      message: errorMessage,
      status: errorObj.status,
      rateLimitHeaders: rateLimitInfo,
      timestamp: new Date().toISOString(),
      // Don't log redirectUri, codeVerifier, or code in production
    });
    throw error;
  }

  // Calculate expiration
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Store tokens first (without user info to avoid rate limits)
  // We'll fetch user info separately if needed
  // Use provided client if available (for proper session context), otherwise create one
  const supabase = supabaseClient || await createClient();
  
  // Note: User creation is now handled in the callback route before calling this function
  // This ensures proper session context for RLS policies
  
  const { data: existing, error: existingError } = await supabase
    .from("twitter_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    logger.error("Error checking for existing tokens:", {
      userId,
      error: existingError.message,
      code: existingError.code,
    });
  }

  if (existing) {
    logger.debug("Updating existing Twitter tokens", { userId });
    const { error: updateError } = await supabase
      .from("twitter_tokens")
      .update({
        access_token: accessToken,
        refresh_token: refreshToken || null,
        expires_at: expiresAt,
        // Don't update user info here - will be fetched separately if needed
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      logger.error("Error updating Twitter tokens:", {
        userId,
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
      });
      throw new Error(`Failed to update Twitter tokens: ${updateError.message}`);
    }
    
    logger.debug("Twitter tokens updated successfully", { userId });
  } else {
    logger.debug("Inserting new Twitter tokens", { userId });
    const { error: insertError } = await supabase.from("twitter_tokens").insert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: expiresAt,
      // Don't set user info here - will be fetched separately if needed
    });

    if (insertError) {
      logger.error("Error inserting Twitter tokens:", {
        userId,
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
      });
      throw new Error(`Failed to insert Twitter tokens: ${insertError.message}`);
    }
    
    logger.debug("Twitter tokens inserted successfully", { userId });
  }

  // Try to get user info, but don't fail if rate limited
  // This allows the OAuth flow to complete even if v2.me() is rate limited
  let twitterUser: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
  } | undefined;

  try {
    logger.debug("Attempting to call Twitter API v2.me() to get user info", {
      timestamp: new Date().toISOString(),
    });
    
    const userClient = new TwitterApi(accessToken);
    const user = await userClient.v2.me();
    
    logger.debug("Twitter API v2.me() successful", {
      userId: user.data.id,
      username: user.data.username,
    });

    twitterUser = {
      id: user.data.id,
      username: user.data.username || "",
      name: user.data.name || "",
      profile_image_url: user.data.profile_image_url,
    };

    // Update tokens with user info if we got it
    await supabase
      .from("twitter_tokens")
      .update({
        twitter_user_id: user.data.id,
        twitter_username: user.data.username || null,
      })
      .eq("user_id", userId);
  } catch (error: unknown) {
    const errorObj = error as { code?: string; status?: number; message?: string };
    const errorCode = errorObj.code || errorObj.status?.toString();
    
    // If rate limited, log but don't fail - tokens are already stored
    if (errorCode === "429" || errorObj.status === 429) {
      logger.warn("Twitter API v2.me() rate limited during OAuth - tokens stored, user info will be fetched later", {
        timestamp: new Date().toISOString(),
      });
      // Return without user info - it can be fetched later when needed
    } else {
      // For other errors, log but still continue
      logger.warn("Failed to get Twitter user info during OAuth (non-fatal):", {
        code: errorCode,
        message: errorObj.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    accessToken,
    refreshToken,
    expiresIn,
    twitterUser, // May be undefined if rate limited
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
  logger.debug("Attempting to refresh Twitter token", {
    userId,
    timestamp: new Date().toISOString(),
  });
  
  const supabase = await createClient();
  
  // Get current token data
  const { data: tokenData } = await supabase
    .from("twitter_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenData?.refresh_token) {
    logger.debug("No refresh token available for user", { userId });
    return null;
  }

  const client = getTwitterOAuthClient();

  try {
    logger.debug("Calling Twitter OAuth2 refresh token endpoint", {
      timestamp: new Date().toISOString(),
    });
    
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
