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
  config: ScoutConfig;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoutConfig {
  intentShapes?: ScoutIntentType[];
  domain?: string;
  relationshipTarget?: RelationshipTarget;
  sensitivity?: "emerging" | "established";
}

export type RelationshipTarget =
  | "collaborator"
  | "hire"
  | "mentor"
  | "peer"
  | "investment"
  | "track";

export type ScoutIntentType =
  | "propose"
  | "synthesize"
  | "critique"
  | "seek-collaborators"
  | "teach"
  | "build-in-public";

export interface ScoutMatch {
  id: string;
  scoutProfileId: string;
  twitterUserId: string;
  score: number;
  probability: number;
  snapshotReasoning: string;
  createdAt: Date;
}

