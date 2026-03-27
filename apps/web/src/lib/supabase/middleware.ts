import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Detect if request came through a reverse proxy (Cloudflare Tunnel)
  const isForwarded = request.headers.get("x-forwarded-proto") === "https" ||
    request.headers.get("cf-visitor")?.includes('"scheme":"https"');

  const supabase = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { storageKey: "sb-notiflow-auth-token" },
      cookieOptions: {
        // When behind Cloudflare Tunnel (HTTPS→HTTP), cookies need Secure=true
        // because the browser sees HTTPS, even though Next.js sees HTTP
        secure: isForwarded,
        sameSite: "lax" as const,
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOpts = { ...options };
            if (isForwarded) cookieOpts.secure = true;
            supabaseResponse.cookies.set(name, value, cookieOpts as never);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths that don't require auth
  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/supabase-proxy");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from landing/login to dashboard
  if (user && (pathname === "/" || pathname.startsWith("/login"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Check if user profile exists and is active (protected routes only)
  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active) {
      // Missing or deactivated profile — sign out and redirect
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", profile ? "deactivated" : "no_profile");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
