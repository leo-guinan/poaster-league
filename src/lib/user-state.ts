import { createClient } from "@/lib/supabase/server";
import { UserState } from "@/lib/types/user";

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
  const identityState: "twitter-not-linked" | "twitter-linked" =
    userProfile.twitter_user_id && userProfile.twitter_verified
      ? "twitter-linked"
      : "twitter-not-linked";

  // Determine write permission
  const writePermission: "read-only" | "write-enabled" =
    userProfile.write_permission ? "write-enabled" : "read-only";

  // Determine scout status
  const scoutStatus: "inactive" | "active" = userProfile.scout_active
    ? "active"
    : "inactive";

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

