# Local LLM Integration (Ollama + Qwen 3.5 9B) — Phase 1+2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ollama (Qwen 3.5 9B) as an AI provider for message parsing → automatic order creation, with fallback to Claude API and regex.

**Architecture:** New `apps/web/src/lib/ai/` module with Ollama HTTP client, message parsing pipeline (LLM → product matching → order creation), and API route. Settings extended with `ollama` provider. Fallback chain: Ollama → Claude API → regex.

**Tech Stack:** Next.js 16, Ollama REST API, Supabase (PostgREST), TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/ai/ollama-client.ts` | Ollama HTTP client (generate + chat) |
| Create | `apps/web/src/lib/ai/prompts.ts` | System/user prompt templates for message parsing |
| Create | `apps/web/src/lib/ai/parse-message.ts` | Message parsing pipeline: context → LLM → parse JSON |
| Create | `apps/web/src/lib/ai/match-products.ts` | 7-level product matching against DB |
| Create | `apps/web/src/lib/ai/create-order-from-parse.ts` | Parse result → orders + order_items INSERT |
| Create | `apps/web/src/app/api/parse-message/route.ts` | POST endpoint for message parsing |
| Create | `apps/web/src/app/api/ai-health/route.ts` | GET endpoint to check Ollama server status |
| Modify | `apps/web/src/lib/queries/settings.ts` | Add `"ollama"` to AIProvider, add `ollama_base_url` |
| Modify | `apps/web/src/components/message-inbox/accordion-detail.tsx` | Add "AI 파싱" button |
| Modify | `apps/web/.env.example` | Add OLLAMA_BASE_URL, OLLAMA_MODEL |

---

### Task 1: Ollama HTTP Client

**Files:**
- Create: `apps/web/src/lib/ai/ollama-client.ts`

- [ ] **Step 1: Create the Ollama client module**

```typescript
/**
 * Ollama REST API client for local LLM inference.
 * Supports both /api/generate (single prompt) and /api/chat (system+user messages).
 */

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT = 30_000;

export interface OllamaGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || "qwen3.5:9b";
}

export async function ollamaGenerate(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<OllamaGenerateResult> {
  const baseUrl = getOllamaBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model ?? getOllamaModel(),
        prompt,
        format: "json",
        stream: false,
        options: {
          temperature: opts?.temperature ?? 0.1,
          num_predict: opts?.maxTokens ?? 1024,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      text: data.response ?? "",
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      durationMs: Math.round((data.total_duration ?? 0) / 1e6),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function ollamaChat(
  systemPrompt: string,
  userPrompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<OllamaGenerateResult> {
  const baseUrl = getOllamaBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model ?? getOllamaModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        stream: false,
        options: {
          temperature: opts?.temperature ?? 0.1,
          num_predict: opts?.maxTokens ?? 1024,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      text: data.message?.content ?? "",
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      durationMs: Math.round((data.total_duration ?? 0) / 1e6),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Check if Ollama server is reachable and model is loaded */
export async function ollamaHealthCheck(): Promise<{
  ok: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const baseUrl = getOllamaBaseUrl();
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models ?? []).map((m: { name: string }) => m.name);
    return { ok: true, models };
  } catch (e) {
    return { ok: false, models: [], error: (e as Error).message };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/ai/ollama-client.ts
git commit -m "feat: add Ollama HTTP client for local LLM inference"
```

---

### Task 2: Parsing Prompts

**Files:**
- Create: `apps/web/src/lib/ai/prompts.ts`

- [ ] **Step 1: Create the prompts module**

Contains the system prompt and user prompt builder for message parsing, as specified in the design document (section 3.3).

```typescript
export interface AliasEntry {
  alias: string;
  product_name: string;
}

export interface ProductCatalogEntry {
  id: number;
  name: string;
  standard_code: string | null;
}

export const MESSAGE_PARSE_SYSTEM_PROMPT = `당신은 한국 혈액투석 의료기관의 주문 메시지를 분석하는 전문 파서입니다.

## 역할
수신된 텍스트 메시지에서 주문 품목(item), 수량(qty), 단위(unit)를 추출하고,
제공된 alias 목록과 제품 카탈로그를 참조하여 정확한 제품명(matched_product)을 매칭합니다.

## 규칙
1. alias 목록에 정확히 일치하는 항목이 있으면 해당 product_name을 matched_product로 설정
2. 수량이 명시되지 않은 경우 기본값 1
3. 단위가 명시되지 않은 경우 기본값 "piece"
4. 단위 변환: 박스/box/bx→"box", 개/ea→"piece", 봉/팩/pack→"pack", 세트/set→"set", 병→"bottle", 통/캔→"can", 매/장→"sheet", 롤→"roll"
5. 인사말, 질문, 일정 관련 메시지는 주문이 아님 → 빈 배열 반환
6. 비주문 판별 키워드: 감사, 안녕, 수고, 죄송, 네, 예, 좋, 확인, 알겠, 회의, 미팅, 연락, 전화, 문의, ?로 끝나는 문장

## 출력 형식
반드시 JSON으로만 응답하세요. 설명이나 마크다운 없이 순수 JSON만 출력합니다.
{ "items": [...], "confidence": 0.0~1.0 }

items 배열의 각 요소:
{
  "item": "원본 텍스트에서 추출한 품목명",
  "qty": 숫자,
  "unit": "box|piece|pack|set|bottle|can|sheet|roll",
  "matched_product": "매칭된 정식 제품명 또는 null"
}

비주문 메시지:
{ "items": [], "confidence": 0.95 }`;

export function buildUserPrompt(
  hospitalName: string | null,
  aliases: AliasEntry[],
  catalog: ProductCatalogEntry[],
  messageContent: string,
): string {
  const aliasSection = aliases.length > 0
    ? JSON.stringify(aliases.slice(0, 50), null, 2)
    : "등록된 alias 없음";

  const catalogSection = catalog.length > 0
    ? JSON.stringify(catalog.slice(0, 30).map(p => ({ name: p.name, code: p.standard_code })), null, 2)
    : "등록된 제품 없음";

  return `## 병원 정보
병원명: ${hospitalName ?? "알 수 없음"}

## 이 병원의 제품 alias 목록
${aliasSection}

## 등록된 제품 카탈로그
${catalogSection}

## 분석할 메시지
${messageContent}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/ai/prompts.ts
git commit -m "feat: add message parsing prompt templates for local LLM"
```

---

### Task 3: Message Parsing Pipeline

**Files:**
- Create: `apps/web/src/lib/ai/parse-message.ts`

- [ ] **Step 1: Create the parsing pipeline**

This module orchestrates: load context (hospital aliases, product catalog) → call LLM → parse JSON → validate. Falls back to Claude API if Ollama fails, then to regex.

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { ollamaChat } from "./ollama-client";
import { MESSAGE_PARSE_SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { AliasEntry, ProductCatalogEntry } from "./prompts";

export interface ParsedItem {
  item: string;
  qty: number;
  unit: string;
  matched_product: string | null;
}

export interface ParseResult {
  items: ParsedItem[];
  confidence: number;
  method: "ollama" | "cloud" | "regex";
  model: string;
  durationMs: number;
}

/** Load hospital aliases from partner_product_aliases */
async function loadAliases(hospitalId: number | null): Promise<AliasEntry[]> {
  if (!hospitalId) return [];
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("partner_products")
    .select("id, product_source, product_id")
    .eq("partner_type", "hospital")
    .eq("partner_id", hospitalId);
  if (!products?.length) return [];

  const ppIds = products.map(p => p.id);
  const [{ data: aliases }, { data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("partner_product_aliases").select("alias, partner_product_id").in("partner_product_id", ppIds),
    supabase.from("my_drugs").select("id, item_name").in("id", products.filter(p => p.product_source === "drug").map(p => p.product_id)),
    supabase.from("my_devices").select("id, prdlst_nm").in("id", products.filter(p => p.product_source === "device").map(p => p.product_id)),
  ]);

  const nameMap = new Map<number, string>();
  for (const p of products) {
    const drug = drugs?.find(d => d.id === p.product_id);
    const device = devices?.find(d => d.id === p.product_id);
    nameMap.set(p.id, drug?.item_name ?? device?.prdlst_nm ?? "");
  }

  return (aliases ?? [])
    .filter(a => nameMap.get(a.partner_product_id))
    .map(a => ({ alias: a.alias, product_name: nameMap.get(a.partner_product_id)! }));
}

/** Load product catalog for context */
async function loadCatalog(): Promise<ProductCatalogEntry[]> {
  const supabase = createAdminClient();
  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("id, item_name, bar_code").limit(30),
    supabase.from("my_devices").select("id, prdlst_nm, udidi_cd").limit(30),
  ]);

  const results: ProductCatalogEntry[] = [];
  for (const d of drugs ?? []) results.push({ id: d.id, name: d.item_name, standard_code: d.bar_code });
  for (const d of devices ?? []) results.push({ id: d.id, name: d.prdlst_nm, standard_code: d.udidi_cd });
  return results;
}

/** Parse a message using the Ollama LLM */
export async function parseMessage(
  messageContent: string,
  hospitalId: number | null,
  hospitalName: string | null,
): Promise<ParseResult> {
  const [aliases, catalog] = await Promise.all([
    loadAliases(hospitalId),
    loadCatalog(),
  ]);

  const userPrompt = buildUserPrompt(hospitalName, aliases, catalog, messageContent);
  const startMs = Date.now();

  try {
    const result = await ollamaChat(MESSAGE_PARSE_SYSTEM_PROMPT, userPrompt);
    const parsed = JSON.parse(result.text);
    const items: ParsedItem[] = (parsed.items ?? parsed ?? []).map((item: Record<string, unknown>) => ({
      item: String(item.item ?? ""),
      qty: Number(item.qty ?? 1),
      unit: String(item.unit ?? "piece"),
      matched_product: item.matched_product ? String(item.matched_product) : null,
    }));

    return {
      items,
      confidence: Number(parsed.confidence ?? 0.8),
      method: "ollama",
      model: result.inputTokens > 0 ? "qwen3.5:9b" : "unknown",
      durationMs: Date.now() - startMs,
    };
  } catch (ollamaErr) {
    console.warn("[parseMessage] Ollama failed, attempting cloud fallback:", (ollamaErr as Error).message);

    // Cloud fallback: try Claude API if key is available
    try {
      const supabase = createAdminClient();
      const { data: keySetting } = await supabase.from("settings").select("value").eq("key", "ai_api_key_anthropic").single();
      const apiKey = keySetting?.value as string;
      if (apiKey) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: MESSAGE_PARSE_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";
          const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          const items: ParsedItem[] = (parsed.items ?? []).map((item: Record<string, unknown>) => ({
            item: String(item.item ?? ""),
            qty: Number(item.qty ?? 1),
            unit: String(item.unit ?? "piece"),
            matched_product: item.matched_product ? String(item.matched_product) : null,
          }));
          return { items, confidence: Number(parsed.confidence ?? 0.7), method: "cloud", model: "claude-haiku", durationMs: Date.now() - startMs };
        }
      }
    } catch { /* fall through to regex */ }

    // Regex fallback — simple pattern matching
    console.warn("[parseMessage] Cloud fallback failed, using regex");
    const items = regexParse(messageContent);
    return { items, confidence: 0.5, method: "regex", model: "regex", durationMs: Date.now() - startMs };
  }
}

/** Simple regex fallback parser */
function regexParse(content: string): ParsedItem[] {
  const lines = content.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];
  // Pattern: "품목명 수량단위" e.g. "EK15 10박스"
  const pattern = /^(.+?)\s+(\d+)\s*(박스|box|bx|개|ea|봉|팩|pack|세트|set|병|bottle|통|캔|can|매|장|sheet|롤|roll)?$/i;
  const unitMap: Record<string, string> = {
    "박스": "box", "box": "box", "bx": "box",
    "개": "piece", "ea": "piece",
    "봉": "pack", "팩": "pack", "pack": "pack",
    "세트": "set", "set": "set",
    "병": "bottle", "bottle": "bottle",
    "통": "can", "캔": "can", "can": "can",
    "매": "sheet", "장": "sheet", "sheet": "sheet",
    "롤": "roll", "roll": "roll",
  };

  for (const line of lines) {
    const m = line.match(pattern);
    if (m) {
      items.push({
        item: m[1].trim(),
        qty: parseInt(m[2], 10),
        unit: unitMap[m[3]?.toLowerCase() ?? ""] ?? "piece",
        matched_product: null,
      });
    }
  }
  return items;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/ai/parse-message.ts
git commit -m "feat: add message parsing pipeline with Ollama → Claude → regex fallback"
```

---

### Task 4: Product Matching

**Files:**
- Create: `apps/web/src/lib/ai/match-products.ts`

- [ ] **Step 1: Create the product matching module**

7-level matching as specified in the design document (section 3.4).

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLikeValue } from "@/lib/supabase/sanitize";
import type { ParsedItem } from "./parse-message";

export interface MatchedItem extends ParsedItem {
  product_id: number | null;
  product_name_matched: string | null;
  match_level: number; // 1-7
  match_confidence: number;
}

export async function matchProductsBulk(items: ParsedItem[]): Promise<MatchedItem[]> {
  if (items.length === 0) return [];
  const supabase = createAdminClient();

  // Load all drugs and devices for matching
  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("id, item_name, bar_code, entp_name"),
    supabase.from("my_devices").select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm"),
  ]);

  const allProducts = [
    ...(drugs ?? []).map(d => ({ id: d.id, name: d.item_name, code: d.bar_code, type: "drug" as const })),
    ...(devices ?? []).map(d => ({ id: d.id, name: d.prdlst_nm, code: d.udidi_cd, type: "device" as const })),
  ];

  return items.map(item => {
    // Level 1: matched_product exact match
    if (item.matched_product) {
      const found = allProducts.find(p => p.name === item.matched_product);
      if (found) return { ...item, product_id: found.id, product_name_matched: found.name, match_level: 1, match_confidence: 0.95 };
    }

    // Level 2: item text exact match on name
    const exactName = allProducts.find(p => p.name === item.item);
    if (exactName) return { ...item, product_id: exactName.id, product_name_matched: exactName.name, match_level: 2, match_confidence: 0.9 };

    // Level 3: item text exact match on code
    const exactCode = allProducts.find(p => p.code === item.item);
    if (exactCode) return { ...item, product_id: exactCode.id, product_name_matched: exactCode.name, match_level: 3, match_confidence: 0.85 };

    // Level 4: item text partial match (contains) on name
    const lowerItem = item.item.toLowerCase();
    const partialName = allProducts.find(p => p.name.toLowerCase().includes(lowerItem) || lowerItem.includes(p.name.toLowerCase()));
    if (partialName) return { ...item, product_id: partialName.id, product_name_matched: partialName.name, match_level: 4, match_confidence: 0.7 };

    // Level 5: matched_product partial match
    if (item.matched_product) {
      const lowerMatched = item.matched_product.toLowerCase();
      const partialMatched = allProducts.find(p => p.name.toLowerCase().includes(lowerMatched) || lowerMatched.includes(p.name.toLowerCase()));
      if (partialMatched) return { ...item, product_id: partialMatched.id, product_name_matched: partialMatched.name, match_level: 5, match_confidence: 0.65 };
    }

    // Level 6-7: unmatched
    return { ...item, product_id: null, product_name_matched: null, match_level: 7, match_confidence: 0.3 };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/ai/match-products.ts
git commit -m "feat: add 7-level product matching for parsed items"
```

---

### Task 5: Order Creation from Parse Result

**Files:**
- Create: `apps/web/src/lib/ai/create-order-from-parse.ts`

- [ ] **Step 1: Create order creation module**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import type { MatchedItem } from "./match-products";

export interface CreateOrderResult {
  orderId: number;
  orderNumber: string;
  itemCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

export async function createOrderFromParsedItems(
  hospitalId: number,
  sourceMessageId: string,
  items: MatchedItem[],
): Promise<CreateOrderResult> {
  const supabase = createAdminClient();

  // Generate order number
  const { data: orderNumber, error: rpcErr } = await supabase.rpc("generate_order_number");
  if (rpcErr) throw rpcErr;

  const today = new Date().toISOString().slice(0, 10);

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: today,
      hospital_id: hospitalId,
      source_message_id: sourceMessageId,
      status: "draft",
      total_items: items.length,
      notes: `AI 자동 생성 (${items.filter(i => i.product_id).length}/${items.length} 품목 매칭)`,
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  // Insert order items
  if (items.length > 0) {
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.matched_product ?? item.product_name_matched ?? item.item,
      quantity: item.qty,
      unit_type: item.unit,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;
  }

  return {
    orderId: order.id,
    orderNumber,
    itemCount: items.length,
    matchedCount: items.filter(i => i.product_id !== null).length,
    unmatchedCount: items.filter(i => i.product_id === null).length,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/ai/create-order-from-parse.ts
git commit -m "feat: add order creation from AI-parsed message items"
```

---

### Task 6: API Routes

**Files:**
- Create: `apps/web/src/app/api/parse-message/route.ts`
- Create: `apps/web/src/app/api/ai-health/route.ts`

- [ ] **Step 1: Create parse-message API route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseMessage } from "@/lib/ai/parse-message";
import { matchProductsBulk } from "@/lib/ai/match-products";
import { createOrderFromParsedItems } from "@/lib/ai/create-order-from-parse";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const { messageId, autoCreateOrder } = body;

  // Load message
  const { data: message, error: msgErr } = await supabase
    .from("captured_messages")
    .select("id, content, sender, app_name")
    .eq("id", messageId)
    .single();
  if (msgErr || !message) {
    return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
  }

  // Find hospital by sender name
  let hospitalId: number | null = null;
  let hospitalName: string | null = null;
  if (message.sender) {
    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("id, name")
      .ilike("name", `%${message.sender}%`)
      .limit(1);
    if (hospitals?.length) {
      hospitalId = hospitals[0].id;
      hospitalName = hospitals[0].name;
    }
  }

  // Parse message
  const parseResult = await parseMessage(message.content, hospitalId, hospitalName);

  // Match products
  const matchedItems = await matchProductsBulk(parseResult.items);

  // Optionally create order
  let order = null;
  if (autoCreateOrder && matchedItems.length > 0 && hospitalId) {
    order = await createOrderFromParsedItems(hospitalId, messageId, matchedItems);
  }

  return NextResponse.json({
    messageId,
    hospitalId,
    hospitalName,
    parse: {
      items: matchedItems,
      confidence: parseResult.confidence,
      method: parseResult.method,
      model: parseResult.model,
      durationMs: parseResult.durationMs,
    },
    order,
  });
}
```

- [ ] **Step 2: Create ai-health API route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ollamaHealthCheck, getOllamaBaseUrl, getOllamaModel } from "@/lib/ai/ollama-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await ollamaHealthCheck();

  return NextResponse.json({
    ...health,
    baseUrl: getOllamaBaseUrl(),
    configuredModel: getOllamaModel(),
    modelLoaded: health.models.some(m => m.startsWith(getOllamaModel().split(":")[0])),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/parse-message/route.ts apps/web/src/app/api/ai-health/route.ts
git commit -m "feat: add parse-message and ai-health API routes"
```

---

### Task 7: Settings Extension

**Files:**
- Modify: `apps/web/src/lib/queries/settings.ts`

- [ ] **Step 1: Add `"ollama"` to AIProvider type and settings fetch**

In `settings.ts`, change line 3:
```typescript
export type AIProvider = "anthropic" | "google" | "openai" | "ollama";
```

Change line 56 to include `"ollama"`:
```typescript
    ai_provider: (["anthropic", "google", "openai", "ollama"].includes(provider)
```

Add `ollama_base_url` to the settings fetch (add to the `.in("key", [...])` array at line 43):
```
      "ollama_base_url",
```

Add to the return object after `drug_api_key`:
```typescript
    ollama_base_url: (map.get("ollama_base_url") as string)?.replace(/^"|"$/g, "") ?? "",
```

And update the `AISettings` interface to include:
```typescript
  ollama_base_url: string;
```

- [ ] **Step 2: Update .env.example**

Add to `apps/web/.env.example`:
```env
# Ollama (Local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:9b
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/settings.ts apps/web/.env.example
git commit -m "feat: extend AIProvider with ollama, add ollama settings"
```

---

### Task 8: UI — AI Parse Button in Message Detail

**Files:**
- Modify: `apps/web/src/components/message-inbox/accordion-detail.tsx`

- [ ] **Step 1: Add AI parse button and result display**

Add import at top:
```typescript
import { Sparkles } from "lucide-react";
```

Add state inside `AccordionDetail` component (after `commentDraft` state):
```typescript
const [parseResult, setParseResult] = useState<{
  items: Array<{ item: string; qty: number; unit: string; matched_product: string | null; product_id: number | null }>;
  confidence: number;
  method: string;
  durationMs: number;
  order?: { orderId: number; orderNumber: string };
} | null>(null);
const [isParsing, setIsParsing] = useState(false);
```

Add handler function:
```typescript
async function handleAiParse(autoCreate = false) {
  setIsParsing(true);
  try {
    const res = await fetch("/api/parse-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msg.id, autoCreateOrder: autoCreate }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "파싱 실패");
      return;
    }
    const data = await res.json();
    setParseResult({ ...data.parse, order: data.order });
    if (data.order) {
      toast.success(`주문 ${data.order.orderNumber} 생성됨 (${data.order.matchedCount}/${data.order.itemCount} 매칭)`);
      router.refresh();
    } else {
      toast.success(`${data.parse.items.length}건 품목 추출 (${data.parse.method}, ${data.parse.durationMs}ms)`);
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "AI 파싱 중 오류");
  } finally {
    setIsParsing(false);
  }
}
```

Add UI between the message content section and the comments section:
```tsx
{/* AI Parse */}
<div>
  <div className="flex items-center gap-2 mb-1.5">
    <Sparkles className="h-3 w-3 text-primary" />
    <span className="text-xs font-medium text-muted-foreground">AI 파싱</span>
  </div>
  <div className="flex gap-2 mb-2">
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAiParse(false)} disabled={isParsing}>
      <Sparkles className="h-3 w-3" />{isParsing ? "분석중..." : "파싱만"}
    </Button>
    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleAiParse(true)} disabled={isParsing}>
      <Sparkles className="h-3 w-3" />{isParsing ? "분석중..." : "파싱+주문생성"}
    </Button>
  </div>
  {parseResult && (
    <div className="space-y-1.5 rounded border p-2 bg-muted/20">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{parseResult.method} · {parseResult.durationMs}ms · 신뢰도 {(parseResult.confidence * 100).toFixed(0)}%</span>
        {parseResult.order && (
          <a href={`/orders/${parseResult.order.orderId}`} className="text-primary hover:underline">
            {parseResult.order.orderNumber}
          </a>
        )}
      </div>
      {parseResult.items.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-xs rounded bg-background px-2 py-1 border">
          <span className="font-medium">{item.item}</span>
          <span className="text-muted-foreground">{item.qty} {item.unit}</span>
          <span className={item.product_id ? "text-emerald-600" : "text-orange-500"}>
            {item.matched_product ?? "미매칭"}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 2: Verify build**

Run: `npm run build:web`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/accordion-detail.tsx
git commit -m "feat: add AI parse button with result display in message detail"
```
