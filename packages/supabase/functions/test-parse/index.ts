/**
 * test-parse Edge Function
 *
 * Called from the Dashboard "파싱 테스트" UI (Settings page + Message detail).
 * Parses a message using the configured AI provider WITHOUT saving to DB.
 * Uses the same shared parser and matcher as the production parse-message.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, resolveAIProvider } from "../_shared/ai-client.ts";
import {
  regexParse,
  buildParsePrompt,
  matchProductsBulk,
  type ParsedItem,
  type BulkMatchedItem,
} from "../_shared/parser.ts";

// ---------------------------------------------------------------------------
// CORS headers for browser requests from the Dashboard
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Auth: verify JWT (any active user can test parsing)
// ---------------------------------------------------------------------------

async function verifyAuth(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: errorResponse("Missing or invalid Authorization header", 401),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: errorResponse("Invalid or expired token", 401) };
  }

  // Check that the user profile exists and is active
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    return { error: errorResponse("Account is deactivated", 403) };
  }

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// AI parse — uses shared prompt builder + multi-provider client
// ---------------------------------------------------------------------------

async function aiParse(
  content: string,
  provider: string,
  apiKey: string,
  model: string,
  customPrompt: string | null,
  hospitalName: string | null,
  aliases: Array<{ alias: string; product_name: string }>,
): Promise<{ items: ParsedItem[]; tokenUsage: unknown } | null> {
  try {
    // Use custom prompt if configured, otherwise shared prompt builder
    const prompt = customPrompt
      ? `${customPrompt}\n\n주문 메시지:\n${content}`
      : buildParsePrompt(hospitalName, aliases, content);

    const result = await callAI(provider, apiKey, model, prompt);

    if (!result.text) return null;

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = result.text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    // Normalize to shared ParsedItem format (handle both field name conventions)
    const items: ParsedItem[] = Array.isArray(parsed)
      ? parsed.map((item: Record<string, unknown>) => ({
          item: String(item.item ?? item.product_name ?? ""),
          qty: Number(item.qty ?? item.quantity ?? 1),
          unit: String(item.unit ?? "piece"),
          matched_product: item.matched_product
            ? String(item.matched_product)
            : null,
        }))
      : [];

    return {
      items,
      tokenUsage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      },
    };
  } catch (err) {
    console.error("AI parse failed:", err);
    throw err; // Re-throw so the caller can show the actual error to the user
  }
}

// ---------------------------------------------------------------------------
// Settings keys
// ---------------------------------------------------------------------------

const SETTINGS_KEYS = [
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "ai_parse_prompt",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
];

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Only POST method is allowed", 405);
  }

  // Create Supabase admin client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Authenticate (any active user can test)
    const auth = await verifyAuth(req, supabase);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    // Accept both "content" and "message" field names for backwards compatibility
    const content: string | undefined = body.content || body.message;
    const hospital_id: number | undefined = body.hospital_id;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse(
        "content is required and must be a non-empty string",
      );
    }

    const startTime = performance.now();

    // ------------------------------------------------------------------
    // 1. Read AI settings from settings table
    // ------------------------------------------------------------------
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", SETTINGS_KEYS);

    const settingsMap = new Map(
      (settings ?? []).map((s: { key: string; value: unknown }) => [
        s.key,
        s.value,
      ]),
    );

    const aiEnabled =
      settingsMap.get("ai_enabled") === true ||
      settingsMap.get("ai_enabled") === "true";
    const aiParsePrompt = settingsMap.get("ai_parse_prompt") as string | null;

    // Resolve provider, API key, and model via shared helper
    const resolved = resolveAIProvider(settingsMap);

    // ------------------------------------------------------------------
    // 2. Get hospital info + aliases if hospital_id is provided
    // ------------------------------------------------------------------
    let hospitalName: string | null = null;
    let aliases: Array<{ alias: string; product_name: string }> = [];

    if (hospital_id) {
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("name")
        .eq("id", hospital_id)
        .single();
      hospitalName = hospital?.name ?? null;

      const { data: aliasData } = await supabase
        .from("product_aliases")
        .select("alias, products(official_name)")
        .or(`hospital_id.eq.${hospital_id},hospital_id.is.null`);

      aliases = (aliasData ?? []).map(
        (a: { alias: string; products: { official_name: string } | null }) => ({
          alias: a.alias,
          product_name: a.products?.official_name ?? "",
        }),
      );
    }

    // ------------------------------------------------------------------
    // 3. AI parse → fallback to regex
    // ------------------------------------------------------------------
    let parsedItems: ParsedItem[];
    let method: "llm" | "regex";
    let tokenUsage: unknown = null;

    if (aiEnabled && resolved) {
      try {
        const aiResult = await aiParse(
          content,
          resolved.provider,
          resolved.apiKey,
          resolved.model,
          aiParsePrompt,
          hospitalName,
          aliases,
        );

        if (aiResult && aiResult.items.length > 0) {
          parsedItems = aiResult.items;
          method = "llm";
          tokenUsage = aiResult.tokenUsage;
        } else {
          // Fallback to regex
          parsedItems = regexParse(content);
          method = "regex";
        }
      } catch (err) {
        // Show the AI error to the user for debugging
        return errorResponse(
          `AI 파싱 오류: ${(err as Error).message}`,
          502,
        );
      }
    } else {
      // AI disabled or no API key, use regex only
      parsedItems = regexParse(content);
      method = "regex";
    }

    // ------------------------------------------------------------------
    // 4. Match products via shared bulk matcher (NO DB save)
    // ------------------------------------------------------------------
    const matchedItems: BulkMatchedItem[] = await matchProductsBulk(
      supabase,
      parsedItems,
      hospital_id,
    );

    const latencyMs = Math.round(performance.now() - startTime);

    // ------------------------------------------------------------------
    // 5. Map to UI response format and return
    // ------------------------------------------------------------------
    const responseItems = matchedItems.map((m) => ({
      product_name: m.parsed.item,
      quantity: m.parsed.qty,
      unit: m.parsed.unit,
      original_text: m.parsed.item,
      product_id: m.match.product_id,
      product_official_name: m.match.product_name,
      match_confidence: m.match.confidence,
      match_status: m.match.match_status,
    }));

    return jsonResponse({
      success: true,
      items: responseItems,
      method,
      latency_ms: latencyMs,
      ai_provider: method === "llm" ? resolved?.provider : null,
      ai_model: method === "llm" ? resolved?.model : null,
      token_usage: tokenUsage,
      item_count: responseItems.length,
      match_summary: {
        matched: responseItems.filter((i) => i.match_status === "matched")
          .length,
        review: responseItems.filter((i) => i.match_status === "review").length,
        unmatched: responseItems.filter((i) => i.match_status === "unmatched")
          .length,
      },
    });
  } catch (err) {
    console.error("test-parse unexpected error:", err);
    return errorResponse(
      `Internal server error: ${(err as Error).message}`,
      500,
    );
  }
});
