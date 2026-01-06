import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Check if the current user is an admin
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ isAdmin: false, error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = userProfile?.is_admin === true;

    return NextResponse.json({ isAdmin });
  } catch (error) {
    logger.error("Error checking admin status:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ isAdmin: false, error: "Internal server error" }, { status: 500 });
  }
}

