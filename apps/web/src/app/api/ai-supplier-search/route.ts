import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// AI provider calls (same pattern as ai-product-search)
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

async function callGemini(apiKey: string, model: string, prompt: string, retries = 1): Promise<AIResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  if (res.status === 429 && retries > 0) {
    const body = await res.text();
    const delayMatch = body.match(/"retryDelay":\s*"(\d+)s"/);
    const delaySec = Math.min(Number(delayMatch?.[1] ?? 10), 60);
    await new Promise((r) => setTimeout(r, delaySec * 1000));
    return callGemini(apiKey, model, prompt, retries - 1);
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Gemini API 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나, 설정에서 다른 AI 프로바이더로 변경해주세요.");
    }
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
      return "gemini-2.5-flash";
    case "openai":
      return "gpt-4.1-mini";
    default:
      return "claude-haiku-4-5-20251001";
  }
}

// ---------------------------------------------------------------------------
// Supplier search prompt
// ---------------------------------------------------------------------------

function buildSearchPrompt(query: string): string {
  return `당신은 한국 의료기기 유통업체 정보 전문가입니다. 사용자가 입력한 거래처(공급사)명을 기반으로 해당 업체의 상세 정보를 JSON 형식으로 반환해주세요.

검색 거래처명: "${query}"

다음 JSON 형식으로 정확히 반환하세요:
{
  "name": "정식 회사명",
  "short_name": "약칭 또는 줄임말",
  "business_number": "사업자등록번호 (xxx-xx-xxxxx 형식, 모르면 null)",
  "ceo_name": "대표자명",
  "phone": "대표 전화번호",
  "fax": "팩스번호 (모르면 null)",
  "address": "본사 주소",
  "website": "홈페이지 URL (모르면 null)",
  "business_type": "업태 (예: 도매 및 소매업, 제조업 등)",
  "business_category": "종목 (예: 의료기기, 의약품 등)",
  "notes": null
}

규칙:
- 확실하지 않은 정보는 null로 반환하세요
- notes는 항상 null로 반환하세요 (사용자가 직접 입력)
- 반드시 JSON만 반환하세요 (설명 텍스트 없이)
- 의료기기 유통업체가 아닌 경우에도 최선의 정보를 제공하세요
- 한국 업체 기준으로 검색하세요`;
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

    const supplier = JSON.parse(jsonStr);
    const latencyMs = Date.now() - start;

    return NextResponse.json({
      supplier: {
        name: supplier.name ?? query,
        short_name: supplier.short_name ?? null,
        business_number: supplier.business_number ?? null,
        ceo_name: supplier.ceo_name ?? null,
        phone: supplier.phone ?? null,
        fax: supplier.fax ?? null,
        address: supplier.address ?? null,
        website: supplier.website ?? null,
        business_type: supplier.business_type ?? null,
        business_category: supplier.business_category ?? null,
        notes: supplier.notes ?? null,
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
