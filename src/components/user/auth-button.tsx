"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserState } from "@/lib/types/user";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { trackEvent, FATHOM_EVENTS } from "@/lib/analytics";

export function AuthButton() {
  const [userState, setUserState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      trackEvent(FATHOM_EVENTS.SIGN_OUT);
      setUserState(null);
      window.location.reload();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  if (!userState || userState.authState === "anonymous") {
    return (
      <div className="flex items-center gap-2">
        <Link href="/auth/signin">
          <Button variant="ghost" size="sm">
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </Link>
        <Link href="/auth/signup">
          <Button variant="outline" size="sm">
            Sign Up
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {userState.twitterHandle && (
        <span className="text-sm text-muted-foreground">
          @{userState.twitterHandle}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}

