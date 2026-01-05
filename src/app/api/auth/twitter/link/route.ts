import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateUserTwitterIdentity } from "@/lib/user-state";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { twitterUserId, handle, name, avatarUrl } = await request.json();

    if (!twitterUserId || !handle) {
      return NextResponse.json(
        { error: "Twitter user ID and handle are required" },
        { status: 400 }
      );
    }

    await updateUserTwitterIdentity(
      user.id,
      twitterUserId,
      handle,
      name,
      avatarUrl
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error linking Twitter account:", error);
    return NextResponse.json(
      {
        error: "Failed to link Twitter account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

