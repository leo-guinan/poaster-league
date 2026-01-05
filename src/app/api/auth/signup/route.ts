import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();
    const supabase = await createClient();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || null,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create user profile in users table
    if (data.user) {
      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        write_permission: false,
        scout_active: false,
      });

      if (profileError) {
        console.error("Error creating user profile:", profileError);
        // Don't fail the signup if profile creation fails - it can be created later
      }
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      // Note: Supabase may require email confirmation
      // In that case, data.session will be null
      requiresEmailConfirmation: !data.session,
    });
  } catch (error) {
    console.error("Error signing up:", error);
    return NextResponse.json(
      { error: "Failed to sign up" },
      { status: 500 }
    );
  }
}

