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
      return NextResponse.json({ authenticated: false });
    }

    const auth = await getUserTwitterAuth(user.id);

    if (!auth) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      twitterUserId: auth.twitterUserId,
      twitterUsername: auth.twitterUsername,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
