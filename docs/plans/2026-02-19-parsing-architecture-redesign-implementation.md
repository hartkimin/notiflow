# Parsing Architecture Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all parsing logic into Web (Node.js) as the single source of truth, add structured output per AI provider, improve prompts with expanded few-shot examples, add Levenshtein fuzzy matching, and unify error handling.

**Architecture:** Web parser.ts becomes SSOT. Edge Functions become thin proxies that POST to a new `/api/parse` route. AI calls use structured output (tool_use for Claude, json_schema for OpenAI, responseSchema for Gemini) with system/user message separation.

**Tech Stack:** Next.js 16 API Routes, Supabase Edge Functions (Deno), TypeScript, Anthropic/OpenAI/Gemini REST APIs.

---

### Task 1: Add ParseResult types and Levenshtein utility to parser.ts

**Files:**
- Modify: `apps/web/src/lib/parser.ts`

**Step 1: Add ParseResult interface and Levenshtein function after existing types (line ~36)**

Add after the `BulkMatchedItem` interface:

```typescript
export interface ParseResult {
  items: ParsedItem[];
  method: 'llm' | 'regex';
  ai_provider?: string;
  ai_model?: string;
  latency_ms: number;
  token_usage?: { input_tokens: number; output_tokens: number };
  warnings: string[];
  error?: string;
}

/** Levenshtein edit distance for fuzzy matching. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
```

**Step 2: Verify file still exports correctly**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No new errors related to parser.ts

**Step 3: Commit**

```bash
git add apps/web/src/lib/parser.ts
git commit -m "feat(parser): add ParseResult type and Levenshtein utility"
```

---

### Task 2: Expand few-shot examples and restructure prompt builder

**Files:**
- Modify: `apps/web/src/lib/parser.ts`

**Step 1: Replace `FEW_SHOT_EXAMPLES` array (line ~87) with expanded examples**

Replace the entire `FEW_SHOT_EXAMPLES` array:

```typescript
const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: "EK15 10박스 니들 50개",
    aliases: [
      { alias: "EK15", product_name: "혈액투석여과기 EK-15H" },
      { alias: "니들", product_name: "AVF NEEDLE 16G" },
    ],
    output: [
      { item: "EK15", qty: 10, unit: "box", matched_product: "혈액투석여과기 EK-15H" },
      { item: "니들", qty: 50, unit: "piece", matched_product: "AVF NEEDLE 16G" },
    ],
  },
  {
    input: "b 20 G 20",
    aliases: [
      { alias: "b", product_name: "헤모시스비액 12.6L" },
      { alias: "G", product_name: "헤모시스에이지액 10L" },
    ],
    output: [
      { item: "b", qty: 20, unit: "piece", matched_product: "헤모시스비액 12.6L" },
      { item: "G", qty: 20, unit: "piece", matched_product: "헤모시스에이지액 10L" },
    ],
  },
  {
    input: "20개 A타입 니들",
    aliases: [{ alias: "A타입 니들", product_name: "AVF NEEDLE 17G" }],
    output: [
      { item: "A타입 니들", qty: 20, unit: "piece", matched_product: "AVF NEEDLE 17G" },
    ],
  },
  {
    input: "감사합니다 내일 뵙겠습니다",
    aliases: [],
    output: [],
  },
  {
    input: "A 5박스 B 20개 C 3팩",
    aliases: [
      { alias: "A", product_name: "혈액투석여과기 APS-15SA" },
      { alias: "B", product_name: "헤모시스비액 12.6L" },
      { alias: "C", product_name: "에이프리석시네이트투석액" },
    ],
    output: [
      { item: "A", qty: 5, unit: "box", matched_product: "혈액투석여과기 APS-15SA" },
      { item: "B", qty: 20, unit: "piece", matched_product: "헤모시스비액 12.6L" },
      { item: "C", qty: 3, unit: "pack", matched_product: "에이프리석시네이트투석액" },
    ],
  },
  {
    input: "니들",
    aliases: [{ alias: "니들", product_name: "AVF NEEDLE 16G" }],
    output: [
      { item: "니들", qty: 1, unit: "piece", matched_product: "AVF NEEDLE 16G" },
    ],
  },
];
```

**Step 2: Update `buildFewShotSection` to use all examples**

Replace the existing `buildFewShotSection` function:

```typescript
function buildFewShotSection(): string {
  if (FEW_SHOT_EXAMPLES.length === 0) return "";
  const parts: string[] = ["\n## 파싱 예시"];
  for (const ex of FEW_SHOT_EXAMPLES) {
    const aliasCtx = ex.aliases.length > 0
      ? ` (별칭: ${ex.aliases.map(a => `"${a.alias}"→${a.product_name}`).join(", ")})`
      : "";
    parts.push(`\n입력${aliasCtx}: "${ex.input}"`);
    parts.push(`출력: ${JSON.stringify(ex.output)}`);
  }
  return parts.join("\n");
}
```

**Step 3: Add `buildSystemPrompt()` and `buildUserPrompt()` functions**

Add after `buildFewShotSection` and replace the existing `buildParsePrompt`:

```typescript
/** System prompt: static rules, unit table, schema (does not change per message). */
export function buildSystemPrompt(): string {
  return `당신은 혈액투석 의료용품 주문 메시지를 파싱하는 전문가입니다.

## 핵심 규칙
1. 각 줄을 개별 주문 항목으로 파싱하세요.
2. 한 줄에 여러 품목이 있으면 각각 분리하세요 (예: "b 20 G 20" → 2개 항목).
3. 숫자가 없으면 수량을 1로 설정하세요.
4. 단위 매핑:
   - "박스", "box", "bx", "B" → unit: "box"
   - "개", "ea" → unit: "piece"
   - "팩", "pack" → unit: "pack"
   - "봉" → unit: "pack"
   - "세트", "set" → unit: "set"
   - "병" → unit: "bottle"
   - "통", "캔" → unit: "can"
   - "매", "장" → unit: "sheet"
   - "롤" → unit: "roll"
   - 단위 없으면 → "piece"
5. **별칭 매칭이 최우선**: 별칭 목록에 정확히 일치하는 약어가 있으면 반드시 해당 제품으로 매칭하세요.
6. 단일 문자("b", "G", "A" 등)도 별칭 목록에 있으면 유효한 품목명입니다.
7. 영문+숫자 조합("EK15", "NV13")도 별칭 목록에 있으면 품목 코드입니다.
8. 인사말, 질문, 비주문 내용은 is_order=false로 반환하세요.
9. **품목 카탈로그 활용**: 별칭에 없더라도 등록된 품목 카탈로그에서 유사한 제품을 찾으면 해당 정식 품목명(official_name)으로 matched_product를 설정하세요.
10. 별칭 목록에도 없고 품목 카탈로그와도 유사하지 않은 품목만 matched_product를 null로 설정하세요.

## 출력 스키마
{
  "is_order": boolean,        // 주문 메시지 여부
  "items": [
    {
      "item": "원문 약어",
      "qty": 수량(정수, 최소 1),
      "unit": "box|piece|pack|set|bottle|can|sheet|roll",
      "matched_product": "매칭된 정식 제품명 또는 null",
      "confidence": 0.0~1.0    // 매칭 확신도
    }
  ],
  "rejection_reason": "비주문 메시지인 경우 사유 (주문이면 null)"
}`;
}

/** User prompt: dynamic data (aliases, catalog, examples, message). */
export function buildUserPrompt(
  hospitalName: string | null | undefined,
  aliases: AliasEntry[] | null | undefined,
  message: string,
  products?: ProductCatalogEntry[] | null,
): string {
  const aliasSection =
    aliases && aliases.length > 0
      ? `\n## 병원 별칭 목록 (${hospitalName})\n이 병원에서 사용하는 품목 약어입니다. 반드시 이 목록을 기준으로 매칭하세요:\n${aliases.map((a) => `- "${a.alias}" → ${a.product_name}`).join("\n")}\n`
      : "";

  const productSection =
    products && products.length > 0
      ? `\n## 등록된 품목 카탈로그\n${products.map((p) => p.short_name ? `- ${p.official_name} (약칭: ${p.short_name})` : `- ${p.official_name}`).join("\n")}\n`
      : "";

  const fewShotSection = buildFewShotSection();

  return `${aliasSection}${productSection}${fewShotSection}

## 주문 메시지 (${hospitalName || "미확인"})
${message}`;
}

/** Legacy combined prompt (for custom prompt override and backward compat). */
export function buildParsePrompt(
  hospitalName: string | null | undefined,
  aliases: AliasEntry[] | null | undefined,
  message: string,
  products?: ProductCatalogEntry[] | null,
): string {
  return `${buildSystemPrompt()}\n\n${buildUserPrompt(hospitalName, aliases, message, products)}`;
}
```

**Step 4: Verify no type errors**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

**Step 5: Commit**

```bash
git add apps/web/src/lib/parser.ts
git commit -m "feat(parser): expand few-shot examples and split system/user prompts"
```

---

### Task 3: Add structured output support to ai-client.ts

**Files:**
- Modify: `apps/web/src/lib/ai-client.ts`

**Step 1: Add the structured output JSON schema constant and new callAIStructured function**

The key change: each provider uses its native structured output mechanism instead of free-form text.

Replace the entire `apps/web/src/lib/ai-client.ts` with the updated version that:
1. Keeps `callAI` for backward compatibility (used by ai-product-search)
2. Adds `callAIStructured` with system/user message support and structured output

```typescript
/**
 * AI Client for Next.js Server Side
 *
 * Fetch-based AI calls supporting Anthropic, Google Gemini, and OpenAI.
 * - callAI: legacy single-prompt interface (backward compat)
 * - callAIStructured: system/user message separation with structured output
 */

import { createClient } from "@/lib/supabase/server";

export interface AICallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIStructuredResult {
  parsed: unknown;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProviderSettings {
  provider: string;
  apiKey: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Structured output schema (shared across providers)
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

// ---------------------------------------------------------------------------
// Legacy provider calls (single prompt, text response)
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

/** Legacy: single prompt, text response. Used by ai-product-search. */
export function callAI(provider: string, apiKey: string, model: string, prompt: string): Promise<AICallResult> {
  switch (provider) {
    case "google": return callGemini(apiKey, model, prompt);
    case "openai": return callOpenAI(apiKey, model, prompt);
    default: return callClaude(apiKey, model, prompt);
  }
}

// ---------------------------------------------------------------------------
// Structured output provider calls (system + user, JSON schema enforcement)
// ---------------------------------------------------------------------------

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

async function callGeminiStructured(
  apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: PARSE_ORDER_SCHEMA,
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

/** New: system + user prompt with structured output enforcement. */
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
    case "google": return "gemini-2.0-flash";
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
```

**Step 2: Verify no type errors**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/web/src/lib/ai-client.ts
git commit -m "feat(ai-client): add callAIStructured with per-provider structured output"
```

---

### Task 4: Add Levenshtein fuzzy match + AI matched_product priority to matchProductsBulk

**Files:**
- Modify: `apps/web/src/lib/parser.ts` (the `matchProductsBulk` function)

**Step 1: Update `matchProductsBulk` to add AI matched_product priority and fuzzy match**

Replace the `matchProductsBulk` function. Key changes:
- **Before Level 1**: If AI already provided `matched_product`, try to resolve it directly from the product catalog
- **After Level 4 (name_contains)**: Add Level 5 Levenshtein fuzzy match (distance ≤ 2)
- Rename old Level 5 (unmatched) to Level 6

```typescript
export async function matchProductsBulk(
  supabase: SupabaseClient,
  items: ParsedItem[],
  hospitalId?: number | null,
): Promise<BulkMatchedItem[]> {
  if (items.length === 0) return [];

  const { data: products } = await supabase
    .from("products")
    .select("id, name, official_name, short_name")
    .eq("is_active", true);

  let aliasQuery = supabase
    .from("product_aliases")
    .select("id, product_id, alias, alias_normalized, hospital_id");

  if (hospitalId) {
    aliasQuery = aliasQuery.or(
      `hospital_id.eq.${hospitalId},hospital_id.is.null`,
    );
  }

  const { data: aliases } = await aliasQuery;

  // Build in-memory lookup maps
  const hospitalAliasMap = new Map<string, { product_id: number; alias_id: number }>();
  const globalAliasMap = new Map<string, { product_id: number; alias_id: number }>();

  for (const a of aliases ?? []) {
    const key = (a.alias_normalized || a.alias).toLowerCase().trim();
    if (a.hospital_id && a.hospital_id === hospitalId) {
      hospitalAliasMap.set(key, { product_id: a.product_id, alias_id: a.id });
    } else if (!a.hospital_id) {
      globalAliasMap.set(key, { product_id: a.product_id, alias_id: a.id });
    }
  }

  const productMap = new Map<number, { name: string; official_name: string | null; short_name: string | null }>();
  const productNameMap = new Map<string, number>();

  for (const p of products ?? []) {
    productMap.set(p.id, { name: p.name, official_name: p.official_name, short_name: p.short_name });
    productNameMap.set(p.name.toLowerCase().trim(), p.id);
    if (p.short_name) productNameMap.set(p.short_name.toLowerCase().trim(), p.id);
    if (p.official_name) productNameMap.set(p.official_name.toLowerCase().trim(), p.id);
  }

  const matchedAliasIds: number[] = [];

  const results: BulkMatchedItem[] = items.map((parsed) => {
    const norm = normalize(parsed.item);

    // Level 0: AI matched_product priority — if AI already found a match
    if (parsed.matched_product) {
      const aiNorm = parsed.matched_product.toLowerCase().trim();
      const aiProductId = productNameMap.get(aiNorm);
      if (aiProductId) {
        const product = productMap.get(aiProductId);
        return {
          parsed,
          match: {
            product_id: aiProductId,
            product_name: product?.official_name ?? product?.name ?? null,
            confidence: 0.95,
            method: "ai_matched",
            match_status: "matched",
          },
        };
      }
      // AI match not found in DB, fall through to standard matching
    }

    // Level 1: Hospital-specific exact alias (1.0)
    if (hospitalId) {
      const ha = hospitalAliasMap.get(norm);
      if (ha) {
        const product = productMap.get(ha.product_id);
        matchedAliasIds.push(ha.alias_id);
        return {
          parsed,
          match: {
            product_id: ha.product_id,
            product_name: product?.official_name ?? product?.name ?? null,
            confidence: 1.0,
            method: "hospital_alias",
            match_status: "matched",
          },
        };
      }
    }

    // Level 2: Global exact alias (0.95)
    const ga = globalAliasMap.get(norm);
    if (ga) {
      const product = productMap.get(ga.product_id);
      matchedAliasIds.push(ga.alias_id);
      return {
        parsed,
        match: {
          product_id: ga.product_id,
          product_name: product?.official_name ?? product?.name ?? null,
          confidence: 0.95,
          method: "global_alias",
          match_status: "matched",
        },
      };
    }

    // Level 3: Contains match on alias text
    let bestAlias: { product_id: number; confidence: number; alias_id: number; isHospital: boolean } | null = null;

    for (const a of aliases ?? []) {
      const aKey = (a.alias_normalized || a.alias).toLowerCase().trim();
      if (aKey.includes(norm) || norm.includes(aKey)) {
        const longer = Math.max(aKey.length, norm.length);
        const shorter = Math.min(aKey.length, norm.length);
        const confidence = shorter / longer;
        const isHospital = a.hospital_id === hospitalId;

        if (!bestAlias || confidence > bestAlias.confidence || (isHospital && !bestAlias.isHospital)) {
          bestAlias = { product_id: a.product_id, confidence, alias_id: a.id, isHospital };
        }
      }
    }

    if (bestAlias && bestAlias.confidence >= 0.5) {
      const product = productMap.get(bestAlias.product_id);
      matchedAliasIds.push(bestAlias.alias_id);
      const conf = bestAlias.isHospital
        ? Math.max(bestAlias.confidence, 0.9)
        : Math.max(bestAlias.confidence, 0.8);
      return {
        parsed,
        match: {
          product_id: bestAlias.product_id,
          product_name: product?.official_name ?? product?.name ?? null,
          confidence: Math.round(conf * 100) / 100,
          method: "contains",
          match_status: "review",
        },
      };
    }

    // Level 4: Product name contains (0.6)
    let bestProduct: { id: number; confidence: number } | null = null;

    for (const [pName, pId] of productNameMap) {
      if (pName.includes(norm) || norm.includes(pName)) {
        const longer = Math.max(pName.length, norm.length);
        const shorter = Math.min(pName.length, norm.length);
        const confidence = shorter / longer;
        if (!bestProduct || confidence > bestProduct.confidence) {
          bestProduct = { id: pId, confidence };
        }
      }
    }

    if (bestProduct && bestProduct.confidence >= 0.4) {
      const product = productMap.get(bestProduct.id);
      return {
        parsed,
        match: {
          product_id: bestProduct.id,
          product_name: product?.official_name ?? product?.name ?? null,
          confidence: 0.6,
          method: "name_contains",
          match_status: "review",
        },
      };
    }

    // Level 5: Levenshtein fuzzy match (distance ≤ 2, confidence 0.5)
    if (norm.length >= 2) {
      let bestFuzzy: { id: number; name: string; distance: number } | null = null;

      for (const [pName, pId] of productNameMap) {
        if (Math.abs(pName.length - norm.length) > 2) continue;
        const dist = levenshtein(norm, pName);
        if (dist <= 2 && (!bestFuzzy || dist < bestFuzzy.distance)) {
          const product = productMap.get(pId);
          bestFuzzy = { id: pId, name: product?.official_name ?? product?.name ?? pName, distance: dist };
        }
      }

      // Also check aliases
      for (const a of aliases ?? []) {
        const aKey = (a.alias_normalized || a.alias).toLowerCase().trim();
        if (Math.abs(aKey.length - norm.length) > 2) continue;
        const dist = levenshtein(norm, aKey);
        if (dist <= 2 && (!bestFuzzy || dist < bestFuzzy.distance)) {
          const product = productMap.get(a.product_id);
          matchedAliasIds.push(a.id);
          bestFuzzy = {
            id: a.product_id,
            name: product?.official_name ?? product?.name ?? aKey,
            distance: dist,
          };
        }
      }

      if (bestFuzzy) {
        return {
          parsed,
          match: {
            product_id: bestFuzzy.id,
            product_name: bestFuzzy.name,
            confidence: 0.5,
            method: "fuzzy",
            match_status: "review",
          },
        };
      }
    }

    // Level 6: Unmatched
    return {
      parsed,
      match: {
        product_id: null,
        product_name: null,
        confidence: 0,
        method: "unmatched",
        match_status: "unmatched",
        original_text: parsed.item,
      },
    };
  });

  // Update match_count / last_matched_at for matched aliases
  if (matchedAliasIds.length > 0) {
    const uniqueIds = [...new Set(matchedAliasIds)];
    try {
      await supabase.rpc("increment_alias_match_counts", { alias_ids: uniqueIds });
    } catch {
      await supabase
        .from("product_aliases")
        .update({ last_matched_at: new Date().toISOString() })
        .in("id", uniqueIds);
    }
  }

  return results;
}
```

**Step 2: Verify no type errors**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/web/src/lib/parser.ts
git commit -m "feat(parser): add AI matched_product priority and Levenshtein fuzzy match"
```

---

### Task 5: Refactor aiParse in actions.ts to use structured output and unified ParseResult

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

**Step 1: Update imports to include new functions**

Replace the imports at the top of the file:

```typescript
import { callAI, callAIStructured, getAISettings } from "@/lib/ai-client";
import {
  regexParse,
  buildParsePrompt,
  buildSystemPrompt,
  buildUserPrompt,
  matchProductsBulk,
  generateOrderNumber,
  type ParsedItem,
  type ParseResult,
  type BulkMatchedItem,
  type ProductCatalogEntry,
} from "@/lib/parser";
```

**Step 2: Replace the `aiParse` function with structured output version**

Replace the entire `aiParse` function (lines ~250-340):

```typescript
async function aiParse(
  content: string,
  settings: Awaited<ReturnType<typeof getAISettings>>,
  hospitalName: string | null,
  aliases: { alias: string; product_name: string }[],
  products: ProductCatalogEntry[],
): Promise<ParseResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  if (!settings.ai_api_key || !settings.ai_enabled) {
    const reason = !settings.ai_api_key ? "No API key configured" : "AI disabled";
    warnings.push(`${reason} → regex fallback`);
    const items = regexParse(content);
    return {
      items,
      method: "regex",
      latency_ms: Math.round(performance.now() - startTime),
      warnings,
    };
  }

  try {
    // Use custom prompt (legacy single-prompt) or structured output
    if (settings.ai_parse_prompt) {
      // Custom prompt override: use legacy callAI (no structured output)
      const prompt = `${settings.ai_parse_prompt}\n\n주문 메시지:\n${content}`;
      const result = await callAI(
        settings.ai_provider,
        settings.ai_api_key,
        settings.ai_model,
        prompt,
      );

      const latency_ms = Math.round(performance.now() - startTime);

      if (!result.text) {
        warnings.push("Empty AI response (custom prompt) → regex fallback");
        return {
          items: regexParse(content),
          method: "regex",
          ai_provider: settings.ai_provider,
          ai_model: settings.ai_model,
          latency_ms,
          token_usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
          warnings,
        };
      }

      let jsonStr = result.text.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

      const parsed = JSON.parse(jsonStr);
      const items: ParsedItem[] = Array.isArray(parsed)
        ? parsed.map((item: Record<string, unknown>) => ({
            item: String(item.item ?? item.product_name ?? ""),
            qty: Number(item.qty ?? item.quantity ?? 1),
            unit: String(item.unit ?? "piece"),
            matched_product: item.matched_product ? String(item.matched_product) : null,
          }))
        : [];

      return {
        items,
        method: "llm",
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        latency_ms,
        token_usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
        warnings,
      };
    }

    // Standard path: structured output with system/user separation
    const system = buildSystemPrompt();
    const user = buildUserPrompt(hospitalName, aliases, content, products);

    const result = await callAIStructured(
      settings.ai_provider,
      settings.ai_api_key,
      settings.ai_model,
      system,
      user,
    );

    const latency_ms = Math.round(performance.now() - startTime);

    if (!result.parsed) {
      warnings.push("Empty structured output → regex fallback");
      return {
        items: regexParse(content),
        method: "regex",
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        latency_ms,
        token_usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
        warnings,
      };
    }

    const data = result.parsed as {
      is_order?: boolean;
      items?: Array<Record<string, unknown>>;
      rejection_reason?: string;
    };

    // Non-order message detection
    if (data.is_order === false) {
      return {
        items: [],
        method: "llm",
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        latency_ms,
        token_usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
        warnings: data.rejection_reason
          ? [`Non-order: ${data.rejection_reason}`]
          : ["Non-order message"],
      };
    }

    const items: ParsedItem[] = (data.items ?? []).map((item) => ({
      item: String(item.item ?? ""),
      qty: Number(item.qty ?? 1),
      unit: String(item.unit ?? "piece"),
      matched_product: item.matched_product ? String(item.matched_product) : null,
    }));

    return {
      items,
      method: "llm",
      ai_provider: settings.ai_provider,
      ai_model: settings.ai_model,
      latency_ms,
      token_usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
      warnings,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    warnings.push(`AI parse failed: ${errMsg} → regex fallback`);
    const items = regexParse(content);
    return {
      items,
      method: "regex",
      latency_ms: Math.round(performance.now() - startTime),
      warnings,
    };
  }
}
```

**Step 3: Update `parseMessageDirect` to use `ParseResult` and store warnings**

Replace the `parseResult` type handling in `parseMessageDirect`. The key changes are:
- Remove redundant `console.log` statements (they use too much detail now that we have warnings)
- Store warnings in `parse_history.raw_output`
- Use `parseResult.ai_provider` / `parseResult.ai_model` from ParseResult

In the `parseMessageDirect` function, update the parse history insert to include warnings:

Replace the parse_history insert block:
```typescript
  // Log parse history (including warnings)
  await supabase.from("parse_history").insert({
    message_id: messageId,
    parse_method: parseResult.method,
    llm_model: parseResult.method === "llm"
      ? `${parseResult.ai_provider ?? settings.ai_provider}/${parseResult.ai_model ?? settings.ai_model}`
      : null,
    input_text: content,
    raw_output: {
      items: parseResult.items,
      warnings: parseResult.warnings,
    },
    parsed_items: matchedItems.map((m) => ({
      item: m.parsed.item,
      qty: m.parsed.qty,
      unit: m.parsed.unit,
      product_id: m.match.product_id,
      product_name: m.match.product_name,
      confidence: m.match.confidence,
      match_status: m.match.match_status,
    })),
    latency_ms: parseResult.latency_ms,
    token_usage: parseResult.token_usage ?? null,
  });
```

Also update the `parseMessageDirect` signature to return warnings:

```typescript
async function parseMessageDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: number,
  content: string,
  hospitalId: number | null,
  forceOrder: boolean,
): Promise<{ message_id: number; status: string; order_id?: number; items?: number; warnings?: string[] }>
```

And return warnings in each return statement within `parseMessageDirect`.

**Step 4: Update the `parseResult` usage to use the new field names**

The old `parseResult.latencyMs` is now `parseResult.latency_ms`, and `parseResult.tokenUsage` is now `parseResult.token_usage`. Update all references in `parseMessageDirect`.

**Step 5: Verify no type errors**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

**Step 6: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): use structured output AI parsing with unified ParseResult"
```

---

### Task 6: Create /api/parse route for Edge Function proxy

**Files:**
- Create: `apps/web/src/app/api/parse/route.ts`

**Step 1: Create the API route**

This route handles POST requests from Edge Functions (thin proxy). It:
- Authenticates via `PARSE_API_SECRET` header
- Accepts `{ message_id, content, hospital_id, force_order, test_only }`
- Calls the same `parseMessageDirect` logic
- Returns the result

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAI, callAIStructured, getAISettings } from "@/lib/ai-client";
import {
  regexParse,
  buildParsePrompt,
  buildSystemPrompt,
  buildUserPrompt,
  matchProductsBulk,
  generateOrderNumber,
  type ParsedItem,
  type ParseResult,
  type BulkMatchedItem,
  type ProductCatalogEntry,
} from "@/lib/parser";

// ... (the aiParse function and parseMessageCore are extracted as shared utilities)
```

**Important**: To avoid duplicating `aiParse` and `parseMessageDirect`, extract the core parsing logic into a shared function in `parser.ts` or `actions.ts` that both the Server Action and the API Route can use. The cleanest approach:

1. Move `aiParse` from actions.ts into parser.ts as an exported function
2. Move the `parseMessageDirect` core logic (without the Server Action wrapper) into a new exported `parseMessageCore` function in a new file `apps/web/src/lib/parse-service.ts`
3. Both actions.ts and the API route import from parse-service.ts

Actually, to keep it simpler, let's create `apps/web/src/lib/parse-service.ts` that exports `parseMessageCore` and `aiParse`, and both `actions.ts` and the API route use it.

Create `apps/web/src/lib/parse-service.ts`:

```typescript
/**
 * Parse Service — core parsing logic shared between Server Actions and API Routes.
 *
 * Extracted to avoid duplicating the parse pipeline. Both the dashboard
 * (Server Actions) and Edge Function proxy (API Route) call these functions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAI, callAIStructured, type AISettings } from "@/lib/ai-client";
import {
  regexParse,
  buildSystemPrompt,
  buildUserPrompt,
  matchProductsBulk,
  generateOrderNumber,
  type ParsedItem,
  type ParseResult,
  type BulkMatchedItem,
  type ProductCatalogEntry,
} from "@/lib/parser";

// Re-export for consumers
export type { ParseResult, BulkMatchedItem };

/** Get hospital aliases for prompt context. */
export async function getHospitalAliases(
  supabase: SupabaseClient,
  hospitalId: number,
): Promise<{ alias: string; product_name: string }[]> {
  const { data } = await supabase
    .from("product_aliases")
    .select("alias, product_id, products(official_name)")
    .or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);

  return (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => ({
      alias: a.alias as string,
      product_name: (Array.isArray(a.products) ? a.products[0]?.official_name : a.products?.official_name) ?? "",
    }),
  );
}

/** AI parse with structured output (or regex fallback). */
export async function aiParse(
  content: string,
  settings: AISettings,
  hospitalName: string | null,
  aliases: { alias: string; product_name: string }[],
  products: ProductCatalogEntry[],
): Promise<ParseResult> {
  // ... (same implementation as Task 5 Step 2)
}

/** Full parse pipeline: AI parse → product match → order creation. */
export async function parseMessageCore(
  supabase: SupabaseClient,
  settings: AISettings,
  messageId: number,
  content: string,
  hospitalId: number | null,
  forceOrder: boolean,
): Promise<{
  message_id: number;
  status: string;
  order_id?: number;
  items?: number;
  warnings?: string[];
  matched_items?: BulkMatchedItem[];
  parse_result?: ParseResult;
}> {
  // ... (same as current parseMessageDirect logic, but takes supabase and settings as params)
}
```

Then update `actions.ts` to import from `parse-service.ts` instead of having its own copies. And the API route also imports from `parse-service.ts`.

Create `apps/web/src/app/api/parse/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAISettings } from "@/lib/ai-client";
import { parseMessageCore } from "@/lib/parse-service";

export async function POST(req: Request) {
  // Authenticate via shared secret
  const secret = req.headers.get("x-parse-secret");
  if (!secret || secret !== process.env.PARSE_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { message_id, content, hospital_id, force_order, test_only } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Admin client for DB operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const settings = await getAISettings();

  if (test_only) {
    // Test parse: return results without DB writes
    // ... (similar to current test-parse but using parseMessageCore with a flag)
  }

  const result = await parseMessageCore(
    supabase, settings, message_id, content, hospital_id ?? null, force_order ?? false,
  );

  return NextResponse.json(result);
}
```

**Step 2: Verify no type errors and test**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/web/src/lib/parse-service.ts apps/web/src/app/api/parse/route.ts apps/web/src/lib/actions.ts
git commit -m "feat: extract parse-service.ts and add /api/parse route"
```

---

### Task 7: Convert Edge Functions to thin proxies

**Files:**
- Modify: `packages/supabase/functions/parse-message/index.ts`
- Modify: `packages/supabase/functions/test-parse/index.ts`

**Step 1: Replace parse-message with thin proxy**

```typescript
/**
 * parse-message Edge Function — Thin Proxy
 *
 * Trigger: DB Webhook on raw_messages INSERT
 * Forwards to Web API /api/parse for actual parsing.
 */

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response(
        JSON.stringify({ error: "No record in webhook payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const webApiUrl = Deno.env.get("WEB_API_URL");
    const parseSecret = Deno.env.get("PARSE_API_SECRET");

    if (!webApiUrl || !parseSecret) {
      console.error("Missing WEB_API_URL or PARSE_API_SECRET env vars");
      return new Response(
        JSON.stringify({ error: "Proxy not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`${webApiUrl}/api/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-parse-secret": parseSecret,
      },
      body: JSON.stringify({
        message_id: record.id,
        content: record.content,
        hospital_id: record.hospital_id,
        force_order: body.force_order === true,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-message proxy error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
```

**Step 2: Replace test-parse with thin proxy**

```typescript
/**
 * test-parse Edge Function — Thin Proxy
 *
 * Called from Dashboard "파싱 테스트" UI.
 * Forwards to Web API /api/parse?test=true for actual parsing.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Verify auth (keep JWT check — users must be authenticated)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.is_active) {
      return new Response(JSON.stringify({ error: "Account deactivated" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Forward to Web API
    const body = await req.json();
    const content = body.content || body.message;
    const hospital_id = body.hospital_id;

    if (!content || typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const webApiUrl = Deno.env.get("WEB_API_URL");
    const parseSecret = Deno.env.get("PARSE_API_SECRET");

    if (!webApiUrl || !parseSecret) {
      return new Response(JSON.stringify({ error: "Proxy not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("test-parse proxy error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
```

**Step 3: Commit**

```bash
git add packages/supabase/functions/parse-message/index.ts packages/supabase/functions/test-parse/index.ts
git commit -m "refactor(edge-functions): convert parse-message and test-parse to thin proxies"
```

---

### Task 8: Delete unused shared Edge Function files

**Files:**
- Delete: `packages/supabase/functions/_shared/parser.ts`
- Delete: `packages/supabase/functions/_shared/ai-client.ts`

**Step 1: Delete the files**

```bash
rm packages/supabase/functions/_shared/parser.ts
rm packages/supabase/functions/_shared/ai-client.ts
```

**Step 2: Check if _shared directory has other files**

```bash
ls packages/supabase/functions/_shared/
```

If empty, delete the directory too. If other files exist, leave them.

**Step 3: Verify Edge Functions don't import from _shared anymore**

```bash
grep -r "_shared" packages/supabase/functions/parse-message/ packages/supabase/functions/test-parse/
```
Expected: No matches.

**Step 4: Commit**

```bash
git add -A packages/supabase/functions/_shared/
git commit -m "chore: remove duplicated _shared parser and ai-client (logic moved to web)"
```

---

### Task 9: Add Supabase admin client for API Route

**Files:**
- Check/Create: `apps/web/src/lib/supabase/admin.ts`

**Step 1: Check if admin client already exists**

The `/api/parse` route needs a Supabase client with service role key (no user auth context). Check if one exists; if not, create it.

```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
```

**Step 2: Update the API route to use `createAdminClient`**

**Step 3: Add environment variables to .env.local**

```
PARSE_API_SECRET=<generate-a-random-secret>
SUPABASE_SERVICE_ROLE_KEY=<already-should-exist>
```

And for Edge Functions (via `supabase secrets set`):
```
WEB_API_URL=https://<vercel-domain>
PARSE_API_SECRET=<same-secret>
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/supabase/admin.ts
git commit -m "feat: add Supabase admin client for API routes"
```

---

### Task 10: Integration test — test-parse via dashboard

**Step 1: Start dev server**

```bash
cd apps/web && npm run dev
```

**Step 2: Test the parsing pipeline end-to-end**

Use the dashboard "파싱 테스트" UI to test:
1. A simple order message: `"EK15 10박스 니들 50개"`
2. A non-order message: `"감사합니다"`
3. A multi-item inline message: `"b 20 G 20"`

**Step 3: Verify structured output is working**

Check the server logs for:
- `tool_use` (Claude) / `json_schema` (OpenAI) / `responseSchema` (Gemini) usage
- Proper `is_order` field in the response
- `warnings` array in parse_history

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete parsing architecture redesign — Web SSOT with structured output"
```
