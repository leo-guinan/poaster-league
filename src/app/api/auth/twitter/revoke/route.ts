import { NextResponse } from "next/server";
import { revokeTwitterAuth } from "@/lib/twitter-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
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

    await revokeTwitterAuth(user.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to revoke Twitter authentication",
      },
      { status: 500 }
    );
  }
}
