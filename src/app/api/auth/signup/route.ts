import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();
    
    // Create a response object that we'll update as Supabase sets cookies
    let supabaseResponse = NextResponse.next({ request });
    
    // Create Supabase client using request/response pattern (like middleware)
    // This ensures cookies are properly managed in the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

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

    // Create JSON response with user data
    const response = NextResponse.json({
      success: true,
      user: data.user,
      // Note: Supabase may require email confirmation
      // In that case, data.session will be null
      requiresEmailConfirmation: !data.session,
    });
    
    // Copy all Supabase session cookies from supabaseResponse to the JSON response
    // This preserves the session so the user stays logged in (if email confirmation is disabled)
    const allCookies = supabaseResponse.cookies.getAll();
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith("sb-")) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }
    });

    return response;
  } catch (error) {
    console.error("Error signing up:", error);
    return NextResponse.json(
      { error: "Failed to sign up" },
      { status: 500 }
    );
  }
}

