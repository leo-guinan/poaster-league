import { createClient } from "@/lib/supabase/server";
import { UserState } from "@/lib/types/user";
import { env } from "@/lib/env";

export async function getUserState(): Promise<UserState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous state
  if (!user) {
    return {
      authState: "anonymous",
      identityState: "twitter-not-linked",
      writePermission: "read-only",
      scoutStatus: "inactive",
    };
  }

  // Authenticated - fetch user profile
  const { data: userProfile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !userProfile) {
    // User exists in auth but not in users table - create it
    await supabase
      .from("users")
      .insert({
        id: user.id,
        write_permission: false,
        scout_active: false,
      });

    return {
      authState: "authenticated",
      identityState: "twitter-not-linked",
      writePermission: "read-only",
      scoutStatus: "inactive",
      userId: user.id,
    };
  }

  // Determine identity state
  // Check if Twitter is linked by checking both user profile AND tokens table
  // This handles the case where tokens exist but user info wasn't fetched due to rate limits
  // If tokens exist, Twitter is linked (even if user_id isn't set yet due to rate limits)
  let hasTwitterTokens = false;
  let twitterUserIdFromTokens: string | null = null;
  if (user) {
    const { data: tokenData } = await supabase
      .from("twitter_tokens")
      .select("twitter_user_id, access_token")
      .eq("user_id", user.id)
      .maybeSingle();
    // If tokens exist (access_token is present), Twitter is linked
    // twitter_user_id might be null if v2.me() was rate limited, but tokens still prove connection
    hasTwitterTokens = !!tokenData?.access_token;
    twitterUserIdFromTokens = tokenData?.twitter_user_id || null;
  }
  
  const identityState: "twitter-not-linked" | "twitter-linked" =
    (userProfile.twitter_user_id && userProfile.twitter_verified) || hasTwitterTokens
      ? "twitter-linked"
      : "twitter-not-linked";
  
  // If we have Twitter tokens but no user_id in profile, try to fetch it now (if not rate limited)
  // This is a best-effort attempt to populate missing user info
  if (hasTwitterTokens && !userProfile.twitter_user_id && twitterUserIdFromTokens) {
    // Update user profile with Twitter user ID from tokens
    await supabase
      .from("users")
      .update({
        twitter_user_id: twitterUserIdFromTokens,
        twitter_verified: true,
      })
      .eq("id", user.id);
    
    // Update userProfile for this response
    userProfile.twitter_user_id = twitterUserIdFromTokens;
    userProfile.twitter_verified = true;
  } else if (hasTwitterTokens && !userProfile.twitter_user_id && !twitterUserIdFromTokens) {
    // Tokens exist but no user_id - mark as verified so we know it's linked
    // User ID will be fetched later when rate limit resets
    await supabase
      .from("users")
      .update({
        twitter_verified: true,
      })
      .eq("id", user.id);
    
    userProfile.twitter_verified = true;
  }

  // Determine write permission
  const writePermission: "read-only" | "write-enabled" =
    userProfile.write_permission ? "write-enabled" : "read-only";

  // Determine scout status
  // If paywall is off, check if user has a scout profile instead of subscription
  let scoutStatus: "inactive" | "active";
  if (env.paywallLive) {
    scoutStatus = userProfile.scout_active ? "active" : "inactive";
  } else {
    // Paywall is off - check if user has a scout profile
    const { data: scoutProfile } = await supabase
      .from("scout_profiles")
      .select("id, active")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    
    scoutStatus = scoutProfile ? "active" : "inactive";
  }

  return {
    authState: "authenticated",
    identityState,
    writePermission,
    scoutStatus,
    userId: user.id,
    twitterUserId: userProfile.twitter_user_id || undefined,
    twitterHandle: userProfile.handle || undefined,
    twitterName: userProfile.name || undefined,
    twitterAvatar: userProfile.avatar_url || undefined,
  };
}

export async function checkCommunityArchiveEligibility(
  twitterUserId: string
): Promise<boolean> {
  const { checkCommunityArchiveEligibility: checkArchive } = await import(
    "@/lib/community-archive"
  );
  return checkArchive(twitterUserId);
}

export async function updateUserTwitterIdentity(
  userId: string,
  twitterUserId: string,
  handle: string,
  name: string,
  avatarUrl?: string
): Promise<void> {
  const supabase = await createClient();

  // Check Community Archive eligibility
  const isEligible = await checkCommunityArchiveEligibility(twitterUserId);

  await supabase
    .from("users")
    .update({
      twitter_user_id: twitterUserId,
      handle,
      name,
      avatar_url: avatarUrl,
      twitter_verified: true,
      write_permission: isEligible, // Auto-grant if in archive
    })
    .eq("id", userId);
}

