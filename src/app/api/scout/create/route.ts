import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { ScoutConfig } from "@/lib/types/user";

export async function POST(request: NextRequest) {
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

    // Check if user has active subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json(
        { error: "Active subscription required" },
        { status: 403 }
      );
    }

    const config: ScoutConfig = await request.json();

    // Validate config
    if (!config.intentShapes || config.intentShapes.length === 0) {
      return NextResponse.json(
        { error: "At least one intent shape is required" },
        { status: 400 }
      );
    }

    if (config.intentShapes.length > 3) {
      return NextResponse.json(
        { error: "Maximum 3 intent shapes allowed" },
        { status: 400 }
      );
    }

    // Check if user already has a scout profile
    const { data: existingProfile } = await supabase
      .from("scout_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from("scout_profiles")
        .update({
          config,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id)
        .select()
        .single();

      if (error) {
        logger.error("Error updating scout profile:", error);
        throw error;
      }

      return NextResponse.json({ profile: data });
    }

    // Create new profile
    const { data, error } = await supabase
      .from("scout_profiles")
      .insert({
        user_id: user.id,
        config,
        active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating scout profile:", error);
      throw error;
    }

    logger.info("Scout profile created", { profileId: data.id, userId: user.id });

    return NextResponse.json({ profile: data });
  } catch (error) {
    logger.error("Error in scout create:", error);
    return NextResponse.json(
      {
        error: "Failed to create scout profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

