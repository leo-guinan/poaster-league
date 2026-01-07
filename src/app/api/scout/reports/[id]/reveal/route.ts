import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const reportId = resolvedParams.id;
    
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

    const body = await request.json();
    const candidateId = body.candidateId;

    if (!candidateId) {
      return NextResponse.json(
        { error: "Candidate ID required" },
        { status: 400 }
      );
    }

    // Verify report ownership first
    const { data: report } = await supabase
      .from("scout_reports")
      .select(`
        scout_profiles!inner(user_id)
      `)
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    // Handle the nested structure from Supabase join
    const profileData = (report as unknown as { scout_profiles: { user_id: string } | { user_id: string }[] })?.scout_profiles;
    const userId = Array.isArray(profileData) ? profileData[0]?.user_id : profileData?.user_id;
    
    if (!userId || userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Verify candidate belongs to this report
    const { data: candidate, error: candidateError } = await supabase
      .from("scout_report_candidates")
      .select("*")
      .eq("id", candidateId)
      .eq("scout_report_id", reportId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // Update candidate to revealed
    const { data: updated, error: updateError } = await supabase
      .from("scout_report_candidates")
      .update({
        revealed: true,
        revealed_at: new Date().toISOString(),
      })
      .eq("id", candidateId)
      .eq("scout_report_id", reportId)
      .select(`
        *,
        users(id, handle, name, avatar_url, twitter_user_id)
      `)
      .single();

    if (updateError) {
      logger.error("Error revealing candidate:", updateError);
      throw updateError;
    }

    return NextResponse.json({ candidate: updated });
  } catch (error) {
    logger.error("Error in reveal candidate:", error);
    return NextResponse.json(
      {
        error: "Failed to reveal candidate",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

