/**
 * test-parse Edge Function — Thin Proxy
 *
 * Called from Dashboard "파싱 테스트" UI.
 * Verifies JWT auth, then forwards to Web API /api/parse for actual parsing.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST method is allowed" }, 405);
  }

  try {
    // Verify JWT auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Invalid or expired token" }, 401);
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.is_active) {
      return jsonResponse({ error: "Account is deactivated" }, 403);
    }

    // Parse request body
    const body = await req.json();
    const content: string | undefined = body.content || body.message;
    const hospital_id: number | undefined = body.hospital_id;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return jsonResponse({ error: "content is required and must be a non-empty string" }, 400);
    }

    // Forward to Web API
    const webApiUrl = Deno.env.get("WEB_API_URL");
    const parseSecret = Deno.env.get("PARSE_API_SECRET");

    if (!webApiUrl || !parseSecret) {
      return jsonResponse({ error: "Proxy not configured" }, 500);
    }

    const res = await fetch(`${webApiUrl}/api/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-parse-secret": parseSecret,
      },
      body: JSON.stringify({
        content,
        hospital_id,
        test_only: true,
      }),
    });

    const data = await res.json();
    return jsonResponse(data, res.status);
  } catch (err) {
    console.error("test-parse proxy error:", err);
    return jsonResponse({ error: `Internal server error: ${(err as Error).message}` }, 500);
  }
});
