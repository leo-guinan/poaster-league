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

    const { data: profile, error } = await supabase
      .from("scout_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      logger.error("Error fetching scout profile:", error);
      throw error;
    }

    return NextResponse.json({ profile });
  } catch (error) {
    logger.error("Error in scout profile fetch:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch scout profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

