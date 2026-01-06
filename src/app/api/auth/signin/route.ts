import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
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

    // Create JSON response with user data
    const response = NextResponse.json({ user: data.user });
    
    // Copy all Supabase session cookies from supabaseResponse to the JSON response
    // This preserves the session so the user stays logged in
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
  } catch {
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}

