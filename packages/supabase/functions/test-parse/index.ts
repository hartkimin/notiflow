/**
 * test-parse Edge Function
 *
 * Called from the Dashboard "파싱 테스트" UI.
 * Parses a message using the configured AI provider WITHOUT saving to DB.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, resolveAIProvider } from "../_shared/ai-client.ts";

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
// Regex fallback parser
// ---------------------------------------------------------------------------

interface ParsedItem {
  product_name: string;
  quantity: number;
  unit: string;
  original_text: string;
}

function regexParse(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content
    .split(/\n|,|\//)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Pattern: product_name + quantity + unit
    const match = line.match(
      /^(.+?)\s+(\d+)\s*(박스|box|BOX|개|봉|팩|pack|ea|EA|세트|set|병|통|매|장|롤|캔)?$/i,
    );

    if (match) {
      const [, name, qty, unit] = match;
      items.push({
        product_name: name.trim(),
        quantity: parseInt(qty, 10),
        unit: normalizeUnit(unit || "개"),
        original_text: line,
      });
      continue;
    }

    // Pattern: quantity + unit + product_name
    const reverseMatch = line.match(
      /^(\d+)\s*(박스|box|BOX|개|봉|팩|pack|ea|EA|세트|set|병|통|매|장|롤|캔)?\s+(.+)$/i,
    );

    if (reverseMatch) {
      const [, qty, unit, name] = reverseMatch;
      items.push({
        product_name: name.trim(),
        quantity: parseInt(qty, 10),
        unit: normalizeUnit(unit || "개"),
        original_text: line,
      });
      continue;
    }

    // Pattern: product_name with embedded number (e.g. "EK15x10")
    const embeddedMatch = line.match(
      /^(.+?)\s*[xX*]\s*(\d+)\s*(박스|box|BOX|개|봉|팩|pack|ea|EA|세트|set|병|통|매|장|롤|캔)?$/i,
    );

    if (embeddedMatch) {
      const [, name, qty, unit] = embeddedMatch;
      items.push({
        product_name: name.trim(),
        quantity: parseInt(qty, 10),
        unit: normalizeUnit(unit || "개"),
        original_text: line,
      });
    }
  }

  return items;
}

function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    "박스": "box",
    box: "box",
    BOX: "box",
    "개": "ea",
    ea: "ea",
    EA: "ea",
    "봉": "bag",
    "팩": "pack",
    pack: "pack",
    "세트": "set",
    set: "set",
    "병": "bottle",
    "통": "can",
    "매": "sheet",
    "장": "sheet",
    "롤": "roll",
    "캔": "can",
  };
  return unitMap[unit] ?? unit.toLowerCase();
}

// ---------------------------------------------------------------------------
// Build AI parse prompt
// ---------------------------------------------------------------------------

function buildParsePrompt(
  content: string,
  customPrompt: string | null,
  aliases: Array<{ alias: string; product_name: string }>,
): string {
  const aliasSection =
    aliases.length > 0
      ? `\n\n참고할 제품 별칭 목록:\n${aliases.map((a) => `- "${a.alias}" → ${a.product_name}`).join("\n")}`
      : "";

  const basePrompt =
    customPrompt ??
    `당신은 의료기기 주문 메시지를 파싱하는 전문가입니다.
주어진 텍스트에서 주문 품목을 추출하여 JSON 배열로 반환하세요.

각 항목은 다음 형식이어야 합니다:
{
  "product_name": "제품명",
  "quantity": 숫자,
  "unit": "단위 (box, ea, bag, pack, set 등)",
  "original_text": "원본 텍스트"
}

규칙:
- 단위가 명시되지 않으면 "ea"로 기본 설정
- 숫자가 없으면 1로 기본 설정
- 제품명은 가능한 정확히 추출
- JSON 배열만 반환하고 다른 텍스트는 포함하지 마세요`;

  return `${basePrompt}${aliasSection}

주문 메시지:
${content}`;
}

// ---------------------------------------------------------------------------
// AI parse — uses the shared multi-provider client
// ---------------------------------------------------------------------------

async function aiParse(
  content: string,
  provider: string,
  apiKey: string,
  model: string,
  customPrompt: string | null,
  aliases: Array<{ alias: string; product_name: string }>,
): Promise<{ items: ParsedItem[]; tokenUsage: unknown } | null> {
  try {
    const prompt = buildParsePrompt(content, customPrompt, aliases);

    const result = await callAI(provider, apiKey, model, prompt);

    if (!result.text) return null;

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = result.text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const items: ParsedItem[] = Array.isArray(parsed)
      ? parsed.map((item: Record<string, unknown>) => ({
          product_name: String(item.product_name ?? ""),
          quantity: Number(item.quantity ?? 1),
          unit: normalizeUnit(String(item.unit ?? "ea")),
          original_text: String(item.original_text ?? ""),
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
// Product matching
// ---------------------------------------------------------------------------

interface MatchedItem extends ParsedItem {
  product_id: number | null;
  product_official_name: string | null;
  match_confidence: number;
  match_status: "matched" | "review" | "unmatched";
}

async function matchProducts(
  supabase: ReturnType<typeof createClient>,
  items: ParsedItem[],
  hospitalId?: number,
): Promise<MatchedItem[]> {
  // Fetch all active products
  const { data: products } = await supabase
    .from("products")
    .select("id, name, official_name, short_name")
    .eq("is_active", true);

  // Fetch aliases (optionally scoped to hospital)
  let aliasQuery = supabase
    .from("product_aliases")
    .select("product_id, alias, alias_normalized");

  if (hospitalId) {
    aliasQuery = aliasQuery.or(
      `hospital_id.eq.${hospitalId},hospital_id.is.null`,
    );
  }

  const { data: aliases } = await aliasQuery;

  // Build lookup maps
  const aliasMap = new Map<string, number>();
  for (const a of aliases ?? []) {
    const key = (a.alias_normalized || a.alias).toLowerCase().trim();
    aliasMap.set(key, a.product_id);
  }

  const productMap = new Map<
    number,
    { name: string; official_name: string | null }
  >();
  const productNameMap = new Map<string, number>();
  for (const p of products ?? []) {
    productMap.set(p.id, { name: p.name, official_name: p.official_name });
    productNameMap.set(p.name.toLowerCase().trim(), p.id);
    if (p.short_name) {
      productNameMap.set(p.short_name.toLowerCase().trim(), p.id);
    }
    if (p.official_name) {
      productNameMap.set(p.official_name.toLowerCase().trim(), p.id);
    }
  }

  return items.map((item): MatchedItem => {
    const nameLower = item.product_name.toLowerCase().trim();

    // 1. Exact alias match
    const aliasProductId = aliasMap.get(nameLower);
    if (aliasProductId !== undefined) {
      const product = productMap.get(aliasProductId);
      return {
        ...item,
        product_id: aliasProductId,
        product_official_name:
          product?.official_name ?? product?.name ?? null,
        match_confidence: 1.0,
        match_status: "matched",
      };
    }

    // 2. Exact product name match
    const nameProductId = productNameMap.get(nameLower);
    if (nameProductId !== undefined) {
      const product = productMap.get(nameProductId);
      return {
        ...item,
        product_id: nameProductId,
        product_official_name:
          product?.official_name ?? product?.name ?? null,
        match_confidence: 1.0,
        match_status: "matched",
      };
    }

    // 3. Partial / fuzzy match
    let bestMatch: { id: number; confidence: number } | null = null;

    for (const [pName, pId] of productNameMap) {
      if (pName.includes(nameLower) || nameLower.includes(pName)) {
        const longer = Math.max(pName.length, nameLower.length);
        const shorter = Math.min(pName.length, nameLower.length);
        const confidence = shorter / longer;

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { id: pId, confidence };
        }
      }
    }

    for (const [aName, aProductId] of aliasMap) {
      if (aName.includes(nameLower) || nameLower.includes(aName)) {
        const longer = Math.max(aName.length, nameLower.length);
        const shorter = Math.min(aName.length, nameLower.length);
        const confidence = shorter / longer;

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { id: aProductId, confidence };
        }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      const product = productMap.get(bestMatch.id);
      return {
        ...item,
        product_id: bestMatch.id,
        product_official_name:
          product?.official_name ?? product?.name ?? null,
        match_confidence: Math.round(bestMatch.confidence * 100) / 100,
        match_status: bestMatch.confidence >= 0.8 ? "matched" : "review",
      };
    }

    // 4. No match
    return {
      ...item,
      product_id: null,
      product_official_name: null,
      match_confidence: 0,
      match_status: "unmatched",
    };
  });
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
    // 2. Get hospital aliases if hospital_id is provided
    // ------------------------------------------------------------------
    let aliases: Array<{ alias: string; product_name: string }> = [];

    if (hospital_id) {
      const { data: aliasData } = await supabase
        .from("product_aliases")
        .select("alias, products(name)")
        .or(`hospital_id.eq.${hospital_id},hospital_id.is.null`);

      aliases = (aliasData ?? []).map((a) => ({
        alias: a.alias,
        product_name:
          (a as unknown as { products: { name: string } | null }).products
            ?.name ?? "",
      }));
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
    // 4. Match products (NO DB save)
    // ------------------------------------------------------------------
    const matchedItems = await matchProducts(
      supabase,
      parsedItems,
      hospital_id,
    );

    const latencyMs = Math.round(performance.now() - startTime);

    // ------------------------------------------------------------------
    // 5. Return results
    // ------------------------------------------------------------------
    return jsonResponse({
      success: true,
      items: matchedItems,
      method,
      latency_ms: latencyMs,
      ai_provider: method === "llm" ? resolved?.provider : null,
      ai_model: method === "llm" ? resolved?.model : null,
      token_usage: tokenUsage,
      item_count: matchedItems.length,
      match_summary: {
        matched: matchedItems.filter((i) => i.match_status === "matched")
          .length,
        review: matchedItems.filter((i) => i.match_status === "review").length,
        unmatched: matchedItems.filter((i) => i.match_status === "unmatched")
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
