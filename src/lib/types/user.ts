export type AuthState = "anonymous" | "authenticated";
export type IdentityState = "twitter-not-linked" | "twitter-linked";
export type WritePermission = "read-only" | "write-enabled";
export type ScoutStatus = "inactive" | "active";

export interface UserState {
  authState: AuthState;
  identityState: IdentityState;
  writePermission: WritePermission;
  scoutStatus: ScoutStatus;
  userId?: string;
  twitterUserId?: string;
  twitterHandle?: string;
  twitterName?: string;
  twitterAvatar?: string;
}

export interface WriteRequest {
  id: string;
  userId: string;
  twitterUserId: string;
  twitterHandle: string;
  status: "pending" | "approved" | "denied";
  createdAt: Date;
  reviewedAt?: Date;
  reviewerNotes?: string;
}

export interface ScoutProfile {
  id: string;
  userId: string;
  config: {
    topics?: string[];
    intentPatterns?: string[];
    relationshipTargets?: string[];
    exclusions?: string[];
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoutMatch {
  id: string;
  scoutProfileId: string;
  twitterUserId: string;
  score: number;
  probability: number;
  snapshotReasoning: string;
  createdAt: Date;
}

