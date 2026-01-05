"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserState } from "@/lib/types/user";
import { Link as LinkIcon, Lock } from "lucide-react";
import { TwitterAuthIndicator } from "@/components/pro-writer/twitter-auth-indicator";

export function WriteAccessBanner() {
  const [userState, setUserState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

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

  const handleRequestAccess = async () => {
    setRequesting(true);
    try {
      const response = await fetch("/api/write-access/request", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        alert("Write access request submitted. We'll review it shortly.");
        await fetchUserState();
      } else {
        alert(data.error || "Failed to submit request");
      }
    } catch (error) {
      console.error("Error requesting write access:", error);
      alert("Failed to submit request");
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !userState) {
    return null;
  }

  // Show banner if authenticated but Twitter not linked
  if (
    userState.authState === "authenticated" &&
    userState.identityState === "twitter-not-linked"
  ) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-4">
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-start gap-3">
            <LinkIcon className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-medium">
                Link your Twitter account to participate
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Twitter verification is required for all write access.
              </p>
              <TwitterAuthIndicator />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show banner if Twitter linked but no write permission
  if (
    userState.authState === "authenticated" &&
    userState.identityState === "twitter-linked" &&
    userState.writePermission === "read-only"
  ) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-4">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-medium">
                Write access is read-only
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Write access is granted based on demonstrated signal. Request
                access to participate.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestAccess}
                disabled={requesting}
              >
                {requesting ? "Submitting..." : "Request Write Access"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

