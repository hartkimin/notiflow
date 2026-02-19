/**
 * ai-product-search Edge Function
 *
 * Takes a partial product name query and uses the configured AI provider
 * to search for and return structured medical product information
 * matching the Product table schema.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, resolveAIProvider } from "../_shared/ai-client.ts";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

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

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function verifyAuth(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: errorResponse("Missing or invalid Authorization header", 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: errorResponse("Invalid or expired token", 401) };
  }

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
// Product search prompt
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<string, string> = {
  "다이알라이저": "dialyzer",
  "블러드라인": "blood_line",
  "AVF니들": "avf_needle",
  "투석액": "dialysis_solution",
  "필터": "filter",
  "카테터": "catheter",
  "약품": "medication",
  "소모품": "consumable",
  "장비": "equipment",
  "보충제": "supplement",
};

function buildSearchPrompt(query: string): string {
  const categoryList = Object.entries(CATEGORY_MAP)
    .map(([label, key]) => `  "${key}" (${label})`)
    .join("\n");

  return `당신은 의료 품목 정보 전문가입니다. 사용자가 입력한 품목명을 기반으로 해당 의료 품목의 상세 정보를 JSON 형식으로 반환해주세요.

검색 품목명: "${query}"

다음 JSON 형식으로 정확히 반환하세요:
{
  "official_name": "정식 품목명 (제조사 표기 포함)",
  "short_name": "약칭 또는 줄임말",
  "category": "카테고리 코드",
  "manufacturer": "제조사명",
  "ingredient": "주요 성분 또는 재질",
  "efficacy": "용도/효능 설명",
  "standard_code": "표준코드 (EDI코드, 보험코드 등, 모르면 null)",
  "unit": "기본 단위 (개, 박스, 세트, ea 등)",
  "unit_price": null
}

카테고리는 다음 중 하나를 선택하세요:
${categoryList}
  "other" (기타)

위 카테고리에 해당하지 않으면 "other"를 사용하세요.

규칙:
- 확실하지 않은 정보는 null로 반환하세요
- unit_price는 항상 null로 반환하세요 (가격은 사용자가 직접 입력)
- standard_code도 확실하지 않으면 null로 반환하세요
- 반드시 JSON만 반환하세요 (설명 텍스트 없이)
- 의료 품목이 아닌 경우에도 최선의 정보를 제공하세요`;
}

// ---------------------------------------------------------------------------
// Settings keys
// ---------------------------------------------------------------------------

const SETTINGS_KEYS = [
  "ai_provider",
  "ai_model",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Only POST method is allowed", 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
  const auth = await verifyAuth(req, supabase);
  if ("error" in auth) return auth.error;

  // Parse body
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const query = body.query?.trim();
  if (!query) {
    return errorResponse("query is required");
  }

  // Load AI settings
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", SETTINGS_KEYS);

  const settingsMap = new Map(
    (settings ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  const resolved = resolveAIProvider(settingsMap);
  if (!resolved) {
    return errorResponse("AI provider is not configured. Please set up an API key in Settings.", 422);
  }

  // Call AI
  const start = Date.now();
  try {
    const prompt = buildSearchPrompt(query);
    const result = await callAI(resolved.provider, resolved.apiKey, resolved.model, prompt);

    if (!result.text) {
      return errorResponse("AI returned empty response", 500);
    }

    // Extract JSON from response
    let jsonStr = result.text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const product = JSON.parse(jsonStr);
    const latencyMs = Date.now() - start;

    return jsonResponse({
      product: {
        official_name: product.official_name ?? query,
        short_name: product.short_name ?? null,
        category: product.category ?? "other",
        manufacturer: product.manufacturer ?? null,
        ingredient: product.ingredient ?? null,
        efficacy: product.efficacy ?? null,
        standard_code: product.standard_code ?? null,
        unit: product.unit ?? "개",
        unit_price: product.unit_price ?? null,
      },
      ai_provider: resolved.provider,
      ai_model: resolved.model,
      latency_ms: latencyMs,
      token_usage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error("AI product search failed:", err);
    return errorResponse(
      `AI search failed (${latencyMs}ms): ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
});
