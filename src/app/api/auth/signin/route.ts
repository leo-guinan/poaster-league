import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Ensure user exists in users table
    if (data.user) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (!existingUser) {
        await supabase.from("users").insert({
          id: data.user.id,
          write_permission: false,
          scout_active: false,
        });
      }
    }

    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}

