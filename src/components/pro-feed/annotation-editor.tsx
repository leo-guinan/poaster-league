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
import { Send, Loader2, X } from "lucide-react";
import { INTENTS, RELATIONSHIPS } from "@/lib/constants/pro-writer";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";
import { Checkbox } from "@/components/ui/checkbox";

interface AnnotationEditorProps {
  postId: number;
  onCancel: () => void;
  onSuccess: () => void;
  initialContent?: string;
  initialIntent?: IntentType;
  initialRelationships?: RelationshipType[];
}

export function AnnotationEditor({
  postId,
  onCancel,
  onSuccess,
  initialContent = "",
  initialIntent,
  initialRelationships = [],
}: AnnotationEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [intent, setIntent] = useState<IntentType | undefined>(initialIntent);
  const [relationships, setRelationships] = useState<RelationshipType[]>(initialRelationships);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing annotation on mount
  useEffect(() => {
    const loadAnnotation = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/posts/annotate?postId=${postId}`);
        const data = await response.json();

        if (response.ok && data.annotation) {
          setContent(data.annotation.content || "");
          setIntent(data.annotation.intent || undefined);
          setRelationships(data.annotation.relationships || []);
        }
      } catch {
        // Silently fail - annotation might not exist yet
      } finally {
        setIsLoading(false);
      }
    };

    loadAnnotation();
  }, [postId]);

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
      const response = await fetch("/api/posts/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          content: content.trim(),
          intent: intent || undefined,
          relationships: relationships.length > 0 ? relationships : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save annotation");
      }

      // Reset form
      setError(null);

      // Notify parent of success
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save annotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="text-sm text-muted-foreground">Loading annotation...</div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Private Annotation</h3>
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
          <Label htmlFor="annotation-content">Your Annotation</Label>
          <Textarea
            id="annotation-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your private notes about this post..."
            rows={4}
            className="mt-1"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="annotation-intent">Intent</Label>
            <Select
              value={intent || undefined}
              onValueChange={(value) => setIntent(value as IntentType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="annotation-intent" className="mt-1">
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

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Save Annotation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

