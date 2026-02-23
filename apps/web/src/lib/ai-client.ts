/**
 * AI Client for Next.js Server Side
 *
 * Fetch-based AI calls supporting Anthropic, Google Gemini, and OpenAI.
 * Used by server actions that need AI parsing without Edge Functions.
 */

import { createClient } from "@/lib/supabase/server";

export interface AICallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProviderSettings {
  provider: string;
  apiKey: string;
  model: string;
}

export interface AIStructuredResult {
  parsed: unknown;
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

async function callClaude(apiKey: string, model: string, prompt: string): Promise<AICallResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return {
    text: textBlock?.text ?? "",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<AICallResult> {
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
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<AICallResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 1024 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export function callAI(provider: string, apiKey: string, model: string, prompt: string): Promise<AICallResult> {
  switch (provider) {
    case "google": return callGemini(apiKey, model, prompt);
    case "openai": return callOpenAI(apiKey, model, prompt);
    default: return callClaude(apiKey, model, prompt);
  }
}

// ---------------------------------------------------------------------------
// Structured output (JSON schema-based)
// ---------------------------------------------------------------------------

const PARSE_ORDER_SCHEMA = {
  type: "object" as const,
  properties: {
    is_order: { type: "boolean" as const, description: "주문 메시지 여부" },
    items: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          item: { type: "string" as const, description: "원문 약어/품목명" },
          qty: { type: "integer" as const, minimum: 1, description: "수량" },
          unit: {
            type: "string" as const,
            enum: ["box", "piece", "pack", "set", "bottle", "can", "sheet", "roll"],
            description: "단위",
          },
          matched_product: {
            type: ["string", "null"] as const,
            description: "매칭된 정식 제품명 (없으면 null)",
          },
          confidence: {
            type: "number" as const,
            minimum: 0,
            maximum: 1,
            description: "매칭 확신도",
          },
        },
        required: ["item", "qty", "unit"],
      },
    },
    rejection_reason: {
      type: ["string", "null"] as const,
      description: "비주문 메시지인 경우 사유",
    },
  },
  required: ["is_order", "items"],
};

async function callClaudeStructured(
  apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
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
      system,
      messages: [{ role: "user", content: user }],
      tools: [{
        name: "parse_order",
        description: "주문 메시지 파싱 결과를 구조화된 형식으로 반환합니다.",
        input_schema: PARSE_ORDER_SCHEMA,
      }],
      tool_choice: { type: "tool", name: "parse_order" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const toolBlock = data.content?.find((b: { type: string }) => b.type === "tool_use");
  return {
    parsed: toolBlock?.input ?? null,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

// Convert JSON Schema type:["string","null"] → Gemini's nullable:true format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const result = { ...schema };
  if (Array.isArray(result.type)) {
    const types = result.type.filter((t: string) => t !== "null");
    result.type = types.length === 1 ? types[0] : types;
    result.nullable = true;
  }
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  if (result.items) result.items = toGeminiSchema(result.items);
  return result;
}

async function callGeminiStructured(
  apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const geminiSchema = toGeminiSchema(PARSE_ORDER_SCHEMA);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return {
    parsed,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function callOpenAIStructured(
  apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1024,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "parse_order",
          strict: true,
          schema: PARSE_ORDER_SCHEMA,
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return {
    parsed,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export function callAIStructured(
  provider: string, apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
  switch (provider) {
    case "google": return callGeminiStructured(apiKey, model, system, user);
    case "openai": return callOpenAIStructured(apiKey, model, system, user);
    default: return callClaudeStructured(apiKey, model, system, user);
  }
}

// ---------------------------------------------------------------------------
// Settings resolution
// ---------------------------------------------------------------------------

const SETTINGS_KEYS = [
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "ai_parse_prompt",
  "ai_auto_process",
  "ai_confidence_threshold",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
];

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "google": return "gemini-2.5-flash";
    case "openai": return "gpt-4o-mini";
    default: return "claude-haiku-4-5-20251001";
  }
}

export interface AISettings {
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  ai_api_key: string | null;
  ai_parse_prompt: string | null;
  ai_auto_process: boolean;
  ai_confidence_threshold: number;
}

export async function getAISettings(): Promise<AISettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", SETTINGS_KEYS);

  const map = new Map(
    (data ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  const provider = (["anthropic", "google", "openai"].includes(map.get("ai_provider") as string)
    ? (map.get("ai_provider") as string)
    : "anthropic");

  let apiKey = map.get(`ai_api_key_${provider}`) as string | null;
  if (!apiKey || typeof apiKey !== "string") {
    // Fallback to environment variables (matching Edge Function behavior)
    const envKeyMap: Record<string, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      openai: "OPENAI_API_KEY",
    };
    apiKey = process.env[envKeyMap[provider] ?? ""] ?? null;
  }

  const rawModel = map.get("ai_model") as string | null;
  const model = rawModel ? rawModel.replace(/^"|"$/g, "") : getDefaultModel(provider);

  return {
    ai_enabled: map.get("ai_enabled") === true || map.get("ai_enabled") === "true",
    ai_provider: provider,
    ai_model: model,
    ai_api_key: apiKey,
    ai_parse_prompt: (map.get("ai_parse_prompt") as string) ?? null,
    ai_auto_process: map.get("ai_auto_process") === true || map.get("ai_auto_process") === "true",
    ai_confidence_threshold: Number(map.get("ai_confidence_threshold") ?? 0.7),
  };
}
