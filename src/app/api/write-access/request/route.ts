import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's Twitter info
    const { data: userProfile } = await supabase
      .from("users")
      .select("twitter_user_id, handle")
      .eq("id", user.id)
      .single();

    if (!userProfile?.twitter_user_id) {
      return NextResponse.json(
        { error: "Twitter account must be linked first" },
        { status: 400 }
      );
    }

    // Check if request already exists
    const { data: existingRequest } = await supabase
      .from("write_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: "Write access request already pending" },
        { status: 400 }
      );
    }

    // Create write request
    const { data, error } = await supabase
      .from("write_requests")
      .insert({
        user_id: user.id,
        twitter_user_id: userProfile.twitter_user_id,
        twitter_handle: userProfile.handle,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create write access request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

