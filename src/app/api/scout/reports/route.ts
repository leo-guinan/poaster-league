import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's scout profile
    const { data: profile } = await supabase
      .from("scout_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ reports: [] });
    }

    // Get reports for this profile
    const { data: reports, error } = await supabase
      .from("scout_reports")
      .select("*")
      .eq("scout_profile_id", profile.id)
      .order("report_date", { ascending: false })
      .limit(10);

    if (error) {
      logger.error("Error fetching scout reports:", error);
      throw error;
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    logger.error("Error in scout reports fetch:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch scout reports",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

