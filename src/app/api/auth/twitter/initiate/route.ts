import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/twitter-auth";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client using request/response pattern (like callback route)
    // This ensures consistent cookie handling
    let supabaseResponse = NextResponse.next({ request });
    
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

    // Get authenticated user from Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { url, codeVerifier, state } = await getAuthUrl(userId);

    // Store code verifier and state in cookies (in production, use proper session store)
    const response = NextResponse.json({ url });
    
    // Copy Supabase session cookies from supabaseResponse to preserve session
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
    
    // Set OAuth cookies
    response.cookies.set("oauth_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    logger.debug("OAuth initiated successfully", {
      userId,
      state,
      hasCodeVerifier: !!codeVerifier,
      redirectUrl: url.substring(0, 100) + "...",
      supabaseCookiesCopied: allCookies.filter(c => c.name.startsWith("sb-")).length,
    });

    return response;
  } catch (error) {
    logger.error("Error initiating Twitter OAuth:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error: "Failed to initiate Twitter authentication",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
