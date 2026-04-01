import { createBrowserClient } from "@supabase/ssr";

function getSupabaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Use the proxy only when the configured URL is a local address (Docker setup)
  // AND the browser is accessing from an external URL (e.g. notiflow.life tunnel).
  // Cloud Supabase (https://*.supabase.co) is directly reachable from any browser —
  // routing it through the proxy breaks WebSocket/Realtime (Next.js can't upgrade WS).
  if (typeof window !== "undefined" && !configuredUrl.startsWith("https://")) {
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
