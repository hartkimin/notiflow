import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// AI provider calls (fetch-based, no extra SDK needed)
// ---------------------------------------------------------------------------

interface AIResult {
  text: string;
}

async function callClaude(apiKey: string, model: string, prompt: string): Promise<AIResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return { text: textBlock?.text ?? "" };
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<AIResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<AIResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

function callAI(provider: string, apiKey: string, model: string, prompt: string) {
  switch (provider) {
    case "google":
      return callGemini(apiKey, model, prompt);
    case "openai":
      return callOpenAI(apiKey, model, prompt);
    default:
      return callClaude(apiKey, model, prompt);
  }
}

// ---------------------------------------------------------------------------
// Default models per provider
// ---------------------------------------------------------------------------

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "google":
      return "gemini-2.5-flash-preview-05-20";
    case "openai":
      return "gpt-4.1-mini";
    default:
      return "claude-haiku-4-5-20251001";
  }
}

// ---------------------------------------------------------------------------
// Product search prompt
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  ["dialyzer", "다이알라이저"],
  ["blood_line", "블러드라인"],
  ["avf_needle", "AVF니들"],
  ["dialysis_solution", "투석액"],
  ["filter", "필터"],
  ["catheter", "카테터"],
  ["medication", "약품"],
  ["consumable", "소모품"],
  ["equipment", "장비"],
  ["supplement", "보충제"],
  ["other", "기타"],
] as const;

function buildSearchPrompt(query: string): string {
  const categoryList = CATEGORY_OPTIONS.map(([key, label]) => `  "${key}" (${label})`).join("\n");

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
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const supabase = await createClient();

  // Verify auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // Load AI settings from DB
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", SETTINGS_KEYS);

  const settingsMap = new Map(
    (settings ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  // Resolve provider
  const provider = (["anthropic", "google", "openai"].includes(settingsMap.get("ai_provider") as string)
    ? (settingsMap.get("ai_provider") as string)
    : "anthropic");

  const apiKey = settingsMap.get(`ai_api_key_${provider}`) as string | null;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 등록해주세요." },
      { status: 422 },
    );
  }

  const rawModel = settingsMap.get("ai_model") as string | null;
  const model = rawModel
    ? rawModel.replace(/^"|"$/g, "")
    : getDefaultModel(provider);

  // Call AI
  const start = Date.now();
  try {
    const prompt = buildSearchPrompt(query);
    const result = await callAI(provider, apiKey, model, prompt);

    if (!result.text) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // Extract JSON from response
    let jsonStr = result.text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const product = JSON.parse(jsonStr);
    const latencyMs = Date.now() - start;

    return NextResponse.json({
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
      ai_provider: provider,
      ai_model: model,
      latency_ms: latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    return NextResponse.json(
      { error: `AI 검색 실패 (${latencyMs}ms): ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
