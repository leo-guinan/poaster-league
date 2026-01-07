"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserState } from "@/lib/types/user";
import { Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { trackEvent, FATHOM_EVENTS } from "@/lib/analytics";

export function ScoutModeButton() {
  const [userState, setUserState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

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

  const handleClick = async () => {
    if (userState?.scoutStatus === "active") {
      // Navigate to scout dashboard
      trackEvent(FATHOM_EVENTS.PAGE_VIEW_SCOUT);
      router.push("/scout");
      return;
    }

    // Check if paywall is live
    const paywallLive = process.env.NEXT_PUBLIC_PAYWALL_LIVE === "true";

    if (!paywallLive) {
      // Paywall is off - navigate directly to scout setup
      trackEvent(FATHOM_EVENTS.PAGE_VIEW_SCOUT);
      router.push("/scout");
      return;
    }

    // Paywall is live - start subscription flow
    setIsRedirecting(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to start checkout");
        setIsRedirecting(false);
        return;
      }

      const { url } = await response.json();
      if (url) {
        // Track scout mode activation attempt
        trackEvent(FATHOM_EVENTS.SCOUT_MODE_ACTIVATED);
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error starting checkout:", error);
      alert("Failed to start checkout. Please try again.");
      setIsRedirecting(false);
    }
  };

  if (loading) {
    return null;
  }

  // Only show if authenticated
  if (!userState || userState.authState === "anonymous") {
    return null;
  }

  const isActive = userState.scoutStatus === "active";

  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={isRedirecting}
    >
      {isRedirecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        <>
          <Search className="mr-2 h-4 w-4" />
          {isActive
            ? "Scout Mode"
            : process.env.NEXT_PUBLIC_PAYWALL_LIVE === "true"
            ? "Subscribe to Scout Mode"
            : "Scout Mode"}
        </>
      )}
    </Button>
  );
}

