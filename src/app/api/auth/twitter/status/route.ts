import { NextResponse } from "next/server";
import { getUserTwitterAuth } from "@/lib/twitter-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false });
    }

    const auth = await getUserTwitterAuth(user.id);

    if (!auth) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      twitterUserId: auth.twitterUserId,
      twitterUsername: auth.twitterUsername,
    });
  } catch {
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}
