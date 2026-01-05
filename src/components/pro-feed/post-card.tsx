"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, BookOpen, Bookmark } from "lucide-react";
import { INTENTS, RELATIONSHIPS } from "@/lib/constants/pro-writer";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";
import { cn } from "@/lib/utils";

interface PostCardProps {
  id: number;
  content: string;
  intent: IntentType | null;
  relationships: RelationshipType[];
  createdAt: Date;
  publishedAt: Date | null;
  twitterPostId: string | null;
  // In production, these would come from the database
  authorName?: string;
  authorTier?: string;
  signalStatus?: {
    peerAcknowledgments: number;
    mentorResponses: number;
    followUps: number;
    relationshipChanges: number;
  };
  lifecycleState?: "open" | "engaging" | "resolved" | "dormant";
}

const LIFECYCLE_STATES = {
  open: { label: "Open", color: "text-blue-600 dark:text-blue-400" },
  engaging: { label: "Engaging", color: "text-green-600 dark:text-green-400" },
  resolved: { label: "Resolved", color: "text-gray-600 dark:text-gray-400" },
  dormant: { label: "Dormant", color: "text-muted-foreground" },
};

export function PostCard({
  id: _id, // Used as React key in parent component, not used in component
  content,
  intent,
  relationships,
  createdAt,
  publishedAt,
  authorName = "Anonymous",
  authorTier = "pro",
  signalStatus,
  lifecycleState = "open",
}: PostCardProps) {
  // Suppress unused var warning - id is used as React key in parent
  void _id;
  const [isResponding, setIsResponding] = useState(false);

  const intentLabel = intent ? INTENTS[intent].label : "Not specified";
  const relationshipLabels = relationships
    .map((r) => RELATIONSHIPS[r].label)
    .join(", ");

  const formatDate = (date: Date | string | number | null) => {
    if (!date) return "";
    const d = typeof date === "string" || typeof date === "number" 
      ? new Date(date) 
      : date;
    if (isNaN(d.getTime())) return "";
    
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const stateInfo = LIFECYCLE_STATES[lifecycleState];

  return (
    <div className="border-b border-border py-8 first:pt-0">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{authorName}</span>
          <span>·</span>
          <span className="uppercase tracking-wide">{authorTier}</span>
          <span>·</span>
          <span>{formatDate(publishedAt || createdAt)}</span>
        </div>
        <div className={cn("text-xs uppercase tracking-wide", stateInfo.color)}>
          {stateInfo.label}
        </div>
      </div>

      {/* Content */}
      <div className="mb-6 whitespace-pre-wrap text-base leading-relaxed">
        {content}
      </div>

      {/* Metadata */}
      <div className="mb-6 space-y-2 border-t border-border pt-4 text-sm">
        <div>
          <span className="font-medium text-muted-foreground">Intent: </span>
          <span className="text-foreground">{intentLabel}</span>
        </div>
        {relationships.length > 0 && (
          <div>
            <span className="font-medium text-muted-foreground">
              Relationship Target:{" "}
            </span>
            <span className="text-foreground">{relationshipLabels}</span>
          </div>
        )}

        {/* Signal Status */}
        {signalStatus && (
          <div className="mt-4 space-y-1">
            <div className="font-medium text-muted-foreground">Signal Status:</div>
            <div className="space-y-1 pl-4">
              {signalStatus.peerAcknowledgments > 0 && (
                <div className="text-sm">
                  • Peer Acknowledgment{" "}
                  <span className="text-green-600 dark:text-green-400">✓</span>
                </div>
              )}
              {signalStatus.mentorResponses > 0 ? (
                <div className="text-sm">
                  • Mentor Response{" "}
                  <span className="text-green-600 dark:text-green-400">✓</span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  • Mentor Response <span className="text-muted-foreground">—</span>
                </div>
              )}
              {signalStatus.followUps > 0 && (
                <div className="text-sm">
                  • Follow-up{" "}
                  <span className="text-green-600 dark:text-green-400">✓</span>
                </div>
              )}
              {signalStatus.relationshipChanges > 0 && (
                <div className="text-sm">
                  • Relationship Change{" "}
                  <span className="text-green-600 dark:text-green-400">✓</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsResponding(!isResponding)}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Respond
        </Button>
        <Button variant="outline" size="sm">
          <BookOpen className="mr-2 h-4 w-4" />
          Annotate
        </Button>
        <Button variant="outline" size="sm">
          <Bookmark className="mr-2 h-4 w-4" />
          Track
        </Button>
      </div>
    </div>
  );
}

