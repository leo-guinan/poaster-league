"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Loader2, X } from "lucide-react";
import { INTENTS, RELATIONSHIPS } from "@/lib/constants/pro-writer";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";
import { trackEvent, FATHOM_EVENTS } from "@/lib/analytics";

interface ReplyEditorProps {
  parentPostId: number;
  parentTwitterPostId: string | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ReplyEditor({
  parentPostId,
  parentTwitterPostId,
  onCancel,
  onSuccess,
}: ReplyEditorProps) {
  const [content, setContent] = useState("");
  const [intent, setIntent] = useState<IntentType | undefined>(undefined);
  const [relationships, setRelationships] = useState<RelationshipType[]>([]);
  const [postToTwitter, setPostToTwitter] = useState(true); // Default to true if parent has Twitter ID
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update postToTwitter when parentTwitterPostId changes
  useEffect(() => {
    setPostToTwitter(!!parentTwitterPostId);
  }, [parentTwitterPostId]);

  const handleRelationshipToggle = (relationship: RelationshipType) => {
    setRelationships((prev) =>
      prev.includes(relationship)
        ? prev.filter((r) => r !== relationship)
        : [...prev, relationship]
    );
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/posts/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          parentPostId,
          intent: intent || undefined,
          relationships: relationships.length > 0 ? relationships : undefined,
          postToTwitter: postToTwitter && !!parentTwitterPostId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to post reply");
      }

      // Track analytics
      trackEvent(FATHOM_EVENTS.REPLY_POSTED);
      if (data.twitterReplyId) {
        trackEvent(FATHOM_EVENTS.REPLY_POSTED_TO_TWITTER);
      }

      // Show warning if Twitter reply failed
      if (data.twitterError) {
        setError(`Reply posted, but Twitter reply failed: ${data.twitterError}`);
        // Still continue to reset form after a short delay
        setTimeout(() => {
          setError(null);
          setContent("");
          setIntent(undefined);
          setRelationships([]);
          onSuccess();
        }, 3000);
        return;
      }

      // Reset form
      setContent("");
      setIntent(undefined);
      setRelationships([]);
      setError(null);

      // Notify parent of success
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Reply</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="reply-content">Your Reply</Label>
          <Textarea
            id="reply-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your reply..."
            rows={4}
            className="mt-1"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reply-intent">Intent</Label>
            <Select
              value={intent || undefined}
              onValueChange={(value) => setIntent(value as IntentType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="reply-intent" className="mt-1">
                <SelectValue placeholder="Select intent (optional)" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTENTS).map(([key, intentData]) => (
                  <SelectItem key={key} value={key}>
                    {intentData.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Relationships (optional)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(RELATIONSHIPS).map(([key, relData]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                >
                  <Checkbox
                    checked={relationships.includes(key as RelationshipType)}
                    onCheckedChange={() =>
                      handleRelationshipToggle(key as RelationshipType)
                    }
                    disabled={isSubmitting}
                  />
                  <span>{relData.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {parentTwitterPostId && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="post-to-twitter"
              checked={postToTwitter}
              onCheckedChange={(checked) => setPostToTwitter(checked === true)}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="post-to-twitter"
              className="cursor-pointer text-sm font-normal"
            >
              Also reply on Twitter (will show in relationship context)
            </Label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Post Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

