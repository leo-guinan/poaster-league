import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Admin endpoint to fetch all write access requests
 * TODO: Add proper admin authentication check
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!userProfile?.is_admin) {
      logger.warn("Non-admin user attempted to access admin endpoint", { userId: user.id });
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Fetch all write requests with user info
    const { data: requests, error } = await supabase
      .from("write_requests")
      .select(`
        *,
        users:user_id (
          id,
          handle,
          name,
          avatar_url,
          twitter_verified
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching write requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch write requests" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    logger.error("Error in admin write-requests endpoint:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

