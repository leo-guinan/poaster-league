import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Admin endpoint to approve or deny write access requests
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, reviewerNotes } = await request.json();

    if (!status || !["approved", "denied"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved' or 'denied'" },
        { status: 400 }
      );
    }

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
      logger.warn("Non-admin user attempted to update write request", { userId: user.id, requestId: id });
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get the write request
    const { data: writeRequest, error: fetchError } = await supabase
      .from("write_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !writeRequest) {
      return NextResponse.json(
        { error: "Write request not found" },
        { status: 404 }
      );
    }

    // Update the write request
    const { data: updatedRequest, error: updateError } = await supabase
      .from("write_requests")
      .update({
        status,
        reviewer_notes: reviewerNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating write request:", {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        { 
          error: "Failed to update write request",
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    // If approved, grant write permission to the user
    if (status === "approved") {
      const { error: permissionError } = await supabase
        .from("users")
        .update({ write_permission: true })
        .eq("id", writeRequest.user_id);

      if (permissionError) {
        logger.error("Error granting write permission:", permissionError);
        // Don't fail the request update, but log the error
      } else {
        logger.info("Write permission granted", {
          userId: writeRequest.user_id,
          requestId: id,
        });
      }
    }

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    logger.error("Error in admin write-request update endpoint:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

