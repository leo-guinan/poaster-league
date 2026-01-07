import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const reportId = resolvedParams.id;
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

    // Get report and verify ownership
    const { data: report, error: reportError } = await supabase
      .from("scout_reports")
      .select(`
        *,
        scout_profiles!inner(user_id)
      `)
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (report.scout_profiles.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get candidates for this report
    const { data: candidates, error: candidatesError } = await supabase
      .from("scout_report_candidates")
      .select(`
        *,
        users(id, handle, name, avatar_url)
      `)
      .eq("scout_report_id", reportId)
      .order("match_confidence", { ascending: false });

    if (candidatesError) {
      logger.error("Error fetching candidates:", candidatesError);
      throw candidatesError;
    }

    return NextResponse.json({
      report: {
        ...report,
        scout_profiles: undefined, // Remove nested profile
      },
      candidates: candidates || [],
    });
  } catch (error) {
    logger.error("Error in scout report fetch:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch scout report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

