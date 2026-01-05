export type WriterTier = "apprentice" | "pro" | "all-pro";

export type IntentType =
  | "explore"
  | "propose"
  | "argue"
  | "synthesize"
  | "teach"
  | "signal"
  | "invite";

export type RelationshipType =
  | "peer-validation"
  | "mentorship"
  | "apprentices"
  | "collaboration"
  | "patrons-backers"
  | "institutions"
  | "public-trust";

export type QualityCheckStatus = "pass" | "warning" | "excellent";

export interface QualityCheck {
  signal: string;
  status: QualityCheckStatus;
  tooltip: string;
  category: "universal" | "intent-specific" | "relationship-aligned";
}

export interface Intent {
  type: IntentType;
  label: string;
  definition: string;
  example: string;
  icon: string;
}

export interface Relationship {
  type: RelationshipType;
  label: string;
  description: string;
}

export interface DraftState {
  content: string;
  intent: IntentType | null;
  relationships: RelationshipType[];
  postToTwitter: boolean;
  postToProFeed: boolean;
  qualityChecks: QualityCheck[];
  draftMaturity: number; // 0-3
}

