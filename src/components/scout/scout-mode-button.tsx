"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserState } from "@/lib/types/user";
import { Search } from "lucide-react";

export function ScoutModeButton() {
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

  if (loading) {
    return null;
  }

  // Only show if authenticated
  if (!userState || userState.authState === "anonymous") {
    return null;
  }

  return (
    <Button variant="outline" size="sm">
      <Search className="mr-2 h-4 w-4" />
      Scout Mode
    </Button>
  );
}

