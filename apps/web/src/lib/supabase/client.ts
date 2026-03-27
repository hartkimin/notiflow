import { createBrowserClient } from "@supabase/ssr";

function getSupabaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // When running in a browser, check if we can reach Supabase directly.
  // If we're accessing via an external URL (e.g. ngrok), the local Supabase
  // (127.0.0.1:54321) is unreachable — use the Next.js proxy instead.
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isLocalhost) {
      return `${window.location.origin}/supabase-proxy`;
    }
  }
  return configuredUrl;
}

export function createClient() {
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  return createBrowserClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { storageKey: "sb-notiflow-auth-token" },
      cookieOptions: {
        secure: isSecure,
        sameSite: "lax" as const,
        path: "/",
      },
    },
  );
}
