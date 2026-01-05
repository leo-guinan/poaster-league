import {
  Intent,
  Relationship,
  IntentType,
  RelationshipType,
} from "@/lib/types/pro-writer";
import {
  Compass,
  Lightbulb,
  MessageSquare,
  Layers,
  GraduationCap,
  Bell,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export const INTENTS: Record<IntentType, Intent> = {
  explore: {
    type: "explore",
    label: "Explore",
    definition: "Opening a question or territory",
    example: "What if we treated complexity as violence?",
    icon: "compass",
  },
  propose: {
    type: "propose",
    label: "Propose",
    definition: "Offering a specific idea or solution",
    example: "Here's how we could restructure the guild system...",
    icon: "lightbulb",
  },
  argue: {
    type: "argue",
    label: "Argue",
    definition: "Taking a position and defending it",
    example: "The current approach fails because...",
    icon: "message-square",
  },
  synthesize: {
    type: "synthesize",
    label: "Synthesize",
    definition: "Connecting multiple ideas into a new whole",
    example: "These three patterns suggest a larger framework...",
    icon: "layers",
  },
  teach: {
    type: "teach",
    label: "Teach",
    definition: "Explaining how something works",
    example: "Here's how Time Violence calculation works...",
    icon: "graduation-cap",
  },
  signal: {
    type: "signal",
    label: "Signal",
    definition: "Announcing something or marking a moment",
    example: "I'm launching a new project focused on...",
    icon: "bell",
  },
  invite: {
    type: "invite",
    label: "Invite",
    definition: "Calling others to participate or respond",
    example: "Who else has experienced this pattern?",
    icon: "user-plus",
  },
};

export const INTENT_ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  lightbulb: Lightbulb,
  "message-square": MessageSquare,
  layers: Layers,
  "graduation-cap": GraduationCap,
  bell: Bell,
  "user-plus": UserPlus,
};

export const RELATIONSHIPS: Record<RelationshipType, Relationship> = {
  "peer-validation": {
    type: "peer-validation",
    label: "Peer Validation",
    description: "Seeking recognition from equals",
  },
  mentorship: {
    type: "mentorship",
    label: "Mentorship",
    description: "Engaging with mentors or seeking guidance",
  },
  apprentices: {
    type: "apprentices",
    label: "Apprentices",
    description: "Teaching or guiding those learning",
  },
  collaboration: {
    type: "collaboration",
    label: "Collaboration",
    description: "Inviting partnership or joint work",
  },
  "patrons-backers": {
    type: "patrons-backers",
    label: "Patrons / Backers",
    description: "Engaging supporters or financial backers",
  },
  institutions: {
    type: "institutions",
    label: "Institutions",
    description: "Addressing organizations or formal structures",
  },
  "public-trust": {
    type: "public-trust",
    label: "Public Trust",
    description: "Building credibility with broader audience",
  },
};

