"use client";

import { useState, useMemo } from "react";
import { MainEditor } from "./main-editor";
import { IntentPanel } from "./intent-panel";
import { RelationshipPanel } from "./relationship-panel";
import { QualityGate } from "./quality-gate";
import { PublishControls } from "./publish-controls";
import {
  WriterTier,
  DraftState,
  RelationshipType,
  IntentType,
} from "@/lib/types/pro-writer";

interface ProWriterProps {
  tier?: WriterTier;
  initialDraft?: Partial<DraftState>;
  onPublish?: (draft: DraftState) => void;
  onSaveDraft?: (draft: DraftState) => void;
  onRequestReview?: (draft: DraftState) => void;
  isPublishing?: boolean;
  isSaving?: boolean;
}

import { analyzeQuality } from "@/lib/quality-checks";

// Calculate draft maturity (0-3)
function calculateDraftMaturity(
  content: string,
  intent: IntentType | null,
  relationships: RelationshipType[]
): number {
  let maturity = 0;
  if (content.length > 50) maturity++;
  if (content.length > 200) maturity++;
  if (intent) maturity++;
  if (relationships.length > 0) maturity++;
  return Math.min(maturity, 3);
}

export function ProWriter({
  tier = "pro",
  initialDraft,
  onPublish,
  onSaveDraft,
  onRequestReview,
  isPublishing = false,
  isSaving = false,
}: ProWriterProps) {
  const [content, setContent] = useState(initialDraft?.content || "");
  const [intent, setIntent] = useState(initialDraft?.intent || null);
  const [relationships, setRelationships] = useState<RelationshipType[]>(
    (initialDraft?.relationships as RelationshipType[]) || []
  );
  const [postToTwitter, setPostToTwitter] = useState(
    initialDraft?.postToTwitter ?? true
  );
  const [postToProFeed, setPostToProFeed] = useState(
    initialDraft?.postToProFeed ?? true
  );

  const isProTier = tier === "pro" || tier === "all-pro";
  const isAllProTier = tier === "all-pro";

  const qualityChecks = useMemo(
    () => analyzeQuality(content, intent, relationships),
    [content, intent, relationships]
  );

  const draftMaturity = useMemo(
    () => calculateDraftMaturity(content, intent, relationships),
    [content, intent, relationships]
  );

  const handleRelationshipToggle = (relationship: RelationshipType) => {
    setRelationships((prev) => {
      if (prev.includes(relationship)) {
        return prev.filter((r) => r !== relationship);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, relationship];
    });
  };

  const handlePublish = () => {
    const draft: DraftState = {
      content,
      intent,
      relationships,
      postToTwitter,
      postToProFeed,
      qualityChecks,
      draftMaturity,
    };
    onPublish?.(draft);
  };

  const handleSaveDraft = () => {
    const draft: DraftState = {
      content,
      intent,
      relationships,
      postToTwitter,
      postToProFeed,
      qualityChecks,
      draftMaturity,
    };
    onSaveDraft?.(draft);
  };

  const handleRequestReview = () => {
    const draft: DraftState = {
      content,
      intent,
      relationships,
      postToTwitter,
      postToProFeed,
      qualityChecks,
      draftMaturity,
    };
    onRequestReview?.(draft);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1 border-b pb-4">
        <h1 className="text-2xl font-semibold">PRO COMPOSER</h1>
        <p className="text-sm text-muted-foreground">Writing a Move</p>
      </div>

      {/* Main Editor */}
      <div className="space-y-4">
        <MainEditor
          content={content}
          onChange={setContent}
          postToTwitter={postToTwitter}
          postToProFeed={postToProFeed}
          onTwitterToggle={setPostToTwitter}
          onProFeedToggle={setPostToProFeed}
          draftMaturity={draftMaturity}
        />
      </div>

      {/* Intent & Relationships Panel */}
      <IntentPanel
        selectedIntent={intent}
        onSelectIntent={setIntent}
        required={isProTier}
      />

      {/* Relationship Targeting Panel */}
      {isProTier && (
        <RelationshipPanel
          selectedRelationships={relationships}
          onSelectRelationship={handleRelationshipToggle}
          required={isProTier}
        />
      )}

      {/* Quality Gate */}
      <QualityGate checks={qualityChecks} />

      {/* Publish Controls */}
      <PublishControls
        onPublish={handlePublish}
        onSaveDraft={handleSaveDraft}
        onRequestReview={isAllProTier ? handleRequestReview : undefined}
        intent={intent}
        relationships={relationships}
        canRequestReview={isAllProTier}
        isPublishing={isPublishing}
        isSaving={isSaving}
      />
    </div>
  );
}

