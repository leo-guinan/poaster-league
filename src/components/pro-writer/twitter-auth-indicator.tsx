"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Twitter } from "lucide-react";
import { trackEvent, FATHOM_EVENTS } from "@/lib/analytics";

interface TwitterAuthStatus {
  authenticated: boolean;
  twitterUsername?: string;
  twitterUserId?: string;
}

export function TwitterAuthIndicator() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<TwitterAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/twitter/status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setStatus({ authenticated: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Refresh status when Twitter connection is detected in URL
  useEffect(() => {
    const connected = searchParams?.get("connected");
    if (connected === "twitter") {
      // Track Twitter connection
      trackEvent(FATHOM_EVENTS.TWITTER_CONNECT);
      // Delay to ensure backend has processed the connection and database is updated
      // Also clear the query param to prevent repeated refreshes
      setTimeout(() => {
        checkStatus();
        // Remove query param from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.toString());
      }, 1000);
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/auth/twitter/initiate");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No auth URL received");
      }
    } catch (error) {
      console.error("Error initiating Twitter auth:", error);
      alert("Failed to connect Twitter. Please try again.");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch("/api/auth/twitter/revoke", {
        method: "POST",
      });
      if (response.ok) {
        trackEvent(FATHOM_EVENTS.TWITTER_DISCONNECT);
        await checkStatus();
      }
    } catch (error) {
      console.error("Error disconnecting Twitter:", error);
      alert("Failed to disconnect Twitter. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking connection...</span>
      </div>
    );
  }

  const isAuthenticated = status?.authenticated ?? false;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2 flex-1">
        <Twitter className="h-4 w-4 text-[#1DA1F2]" />
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">Connected</span>
              {status?.twitterUsername && (
                <span className="text-xs text-muted-foreground">
                  @{status.twitterUsername}
                </span>
              )}
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Not connected
              </span>
            </>
          )}
        </div>
      </div>
      {isAuthenticated ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={isConnecting}
        >
          Disconnect
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Twitter"
          )}
        </Button>
      )}
    </div>
  );
}

