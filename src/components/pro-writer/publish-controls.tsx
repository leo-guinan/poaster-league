"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INTENTS, RELATIONSHIPS } from "@/lib/constants/pro-writer";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";

interface PublishControlsProps {
  onPublish: () => void;
  onSaveDraft: () => void;
  onRequestReview?: () => void;
  intent: IntentType | null;
  relationships: RelationshipType[];
  canRequestReview?: boolean;
  isPublishing?: boolean;
  isSaving?: boolean;
}

export function PublishControls({
  onPublish,
  onSaveDraft,
  onRequestReview,
  intent,
  relationships,
  canRequestReview = false,
  isPublishing = false,
  isSaving = false,
}: PublishControlsProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const intentLabel = intent ? INTENTS[intent].label : "Not specified";
  const relationshipLabels = relationships
    .map((r) => RELATIONSHIPS[r].label)
    .join(", ");

  const handlePublishClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmPublish = () => {
    setShowConfirmDialog(false);
    onPublish();
  };

  return (
    <>
      <div className="flex items-center gap-3 border-t pt-4">
        <Button
          onClick={handlePublishClick}
          className="flex-1"
          disabled={isPublishing || isSaving}
        >
          {isPublishing ? "Publishing..." : "Publish Move"}
        </Button>
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={isPublishing || isSaving}
        >
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>
        {canRequestReview && onRequestReview && (
          <Button
            variant="ghost"
            onClick={onRequestReview}
            disabled={isPublishing || isSaving}
          >
            Request Review
          </Button>
        )}
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You are publishing a PRO MOVE.</DialogTitle>
            <DialogDescription>
              This post will be evaluated on these terms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div>
              <span className="text-sm font-medium">Intent: </span>
              <span className="text-sm text-muted-foreground">
                {intentLabel}
              </span>
            </div>
            {relationships.length > 0 && (
              <div>
                <span className="text-sm font-medium">Target: </span>
                <span className="text-sm text-muted-foreground">
                  {relationshipLabels || "None"}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPublish}>Confirm Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

