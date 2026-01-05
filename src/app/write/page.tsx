"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { ProWriter } from "@/components/pro-writer/pro-writer";
import { TwitterAuthIndicator } from "@/components/pro-writer/twitter-auth-indicator";
import { WriteAccessBanner } from "@/components/user/write-access-banner";
import { DraftState } from "@/lib/types/pro-writer";
import { UserState } from "@/lib/types/user";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";

function WritePageContent() {
  const searchParams = useSearchParams();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

  const handlePublish = async (draft: DraftState) => {
    setIsPublishing(true);
    setError(null);

    try {
      const response = await fetch("/api/posts/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to publish post");
      }

      // Success - clear form state by resetting the component key
      console.log("Post published successfully:", data);
      setResetKey((prev) => prev + 1);
      setError(null);
      // Optionally redirect to feed or show success toast
      // router.push("/feed");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to publish post";
      setError(errorMessage);
      console.error("Error publishing:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = async (draft: DraftState) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/drafts/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save draft");
      }

      console.log("Draft saved successfully:", data);
      // Could show success toast here
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save draft";
      setError(errorMessage);
      console.error("Error saving draft:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestReview = async (draft: DraftState) => {
    // For now, just save as draft with a special flag
    // In the future, this could create a review request
    await handleSaveDraft(draft);
  };

  // Fetch user state
  useEffect(() => {
    fetchUserState();
  }, []);

  const fetchUserState = async () => {
    try {
      const response = await fetch("/api/user/state");
      const data = await response.json();
      setUserState(data);
    } catch (error) {
      console.error("Error fetching user state:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback messages
  useEffect(() => {
    const connected = searchParams?.get("connected");
    const errorParam = searchParams?.get("error");

    if (connected === "twitter") {
      // Show success message (could use a toast library)
      console.log("Twitter connected successfully!");
      fetchUserState(); // Refresh user state
    }

    if (errorParam) {
      setError(`Twitter authentication failed: ${errorParam}`);
    }
  }, [searchParams]);

  const canWrite =
    userState?.writePermission === "write-enabled" &&
    userState?.identityState === "twitter-linked";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 pt-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Feed
            </Button>
          </Link>
        </div>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
          <WriteAccessBanner />
        </Suspense>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
          <TwitterAuthIndicator />
        </Suspense>
      </div>
      {error && (
        <div className="mx-auto max-w-3xl px-6 pt-4">
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}
      {canWrite ? (
        <ProWriter
          key={resetKey}
          tier="pro"
          onPublish={handlePublish}
          onSaveDraft={handleSaveDraft}
          onRequestReview={handleRequestReview}
          isPublishing={isPublishing}
          isSaving={isSaving}
        />
      ) : (
        <div className="mx-auto max-w-3xl px-6 pt-12">
          <div className="rounded-lg border border-muted bg-muted/50 p-12 text-center">
            <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Write Access Required</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              You need write access to use the Pro Writer. Link your Twitter account
              and request access above.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WritePageContent />
    </Suspense>
  );
}
