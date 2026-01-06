import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    // Create a response object that we'll update as Supabase sets cookies
    let supabaseResponse = NextResponse.next({ request });
    
    // Create Supabase client using request/response pattern
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
    
    await supabase.auth.signOut();
    
    // Create JSON response
    const response = NextResponse.json({ success: true });
    
    // Copy all cookies from supabaseResponse (which will have cleared session cookies)
    // This ensures the session is properly cleared
    const allCookies = supabaseResponse.cookies.getAll();
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith("sb-")) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0, // Clear the cookie
        });
      }
    });
    
    // Also explicitly delete Supabase session cookies
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");
    
    return response;
  } catch {
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}

