/**
 * Shared Parser Module for Supabase Edge Functions
 *
 * Ports three Node.js modules to Deno TypeScript:
 * - regexParser.js  — Korean medical supply order text parser
 * - prompts.js      — Claude AI prompt builder
 * - productMatcher.js — 5-level product matching (without Redis)
 *
 * Also provides order number generation and text normalization utilities.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedItem {
  item: string;
  qty: number;
  unit: string;
  matched_product: string | null;
}

export interface MatchResult {
  product_id: number | null;
  product_name: string | null;
  confidence: number;
  method: string;
  match_status: string;
  original_text?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNIT_MAP: Record<string, string> = {
  "박스": "box",
  "box": "box",
  "bx": "box",
  "개": "piece",
  "ea": "piece",
  "piece": "piece",
  "팩": "pack",
  "pack": "pack",
};

// Main pattern: item name followed by quantity and optional unit
const LINE_PATTERN =
  /^([가-힣A-Za-z][\w가-힣A-Za-z\-\/\.\s]*?)\s+(\d+)\s*(박스|box|bx|개|ea|팩|pack)?\s*$/i;

// Reversed: quantity before item name (e.g. "10 EK15")
const REVERSED_PATTERN =
  /^(\d+)\s+([\w가-힣A-Za-z\-\/\.]+(?:\s+[\w가-힣A-Za-z\-\/\.]+)*?)\s*(박스|box|bx|개|ea|팩|pack)?\s*$/i;

// Inline pattern for "b 20 G 20" style: single-token items with qty
const INLINE_PATTERN =
  /([\w가-힣A-Za-z\-\/\.]+)\s+(\d+)\s*(박스|box|bx|개|ea|팩|pack)?/gi;

// Standalone item pattern: just a product name/alias with no quantity
const STANDALONE_PATTERN = /^([가-힣A-Za-z][\w가-힣A-Za-z\-\/\.]*)\s*$/;

// Filter out greetings, questions, and non-order content
const NON_ORDER_PATTERNS: RegExp[] = [
  /^(감사|안녕|수고|죄송|네|예|좋|확인|알겠)/,
  /\?$/,
  /^(오늘|내일|어제|지금|다음)\s/,
  /회의|미팅|연락|전화|문의/,
];

// ---------------------------------------------------------------------------
// Few-shot examples for the prompt builder
// ---------------------------------------------------------------------------

interface FewShotExample {
  input: string;
  aliases: { alias: string; product_name: string }[];
  output: ParsedItem[];
}

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
];

// ---------------------------------------------------------------------------
// 1. regexParse
// ---------------------------------------------------------------------------

/** Map a raw Korean/English unit string to a normalized unit. */
function mapUnit(raw: string | undefined | null): string {
  if (!raw) return "piece";
  return UNIT_MAP[raw.toLowerCase()] || "piece";
}

/** Parse inline "token qty token qty ..." patterns from a single line. */
function parseInline(line: string): ParsedItem[] {
  const results: ParsedItem[] = [];
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(line)) !== null) {
    results.push({
      item: match[1].trim(),
      qty: parseInt(match[2], 10),
      unit: mapUnit(match[3]),
      matched_product: null,
    });
  }
  return results;
}

/** Parse a single line into zero or more ParsedItem entries. */
function parseLine(line: string): ParsedItem[] {
  // Skip non-order lines
  for (const pattern of NON_ORDER_PATTERNS) {
    if (pattern.test(line)) return [];
  }

  // Count space-separated number-like tokens
  const tokens = line.split(/\s+/);
  const numberTokenCount = tokens.filter((t) =>
    /^\d+(박스|box|bx|개|ea|팩|pack)?$/i.test(t)
  ).length;

  // If multiple standalone numbers, try inline pattern first (e.g. "b 20 G 20")
  if (numberTokenCount >= 2) {
    const inlineResults = parseInline(line);
    if (inlineResults.length >= 2) return inlineResults;
  }

  // Try standard pattern: "item qty unit"
  const stdMatch = line.match(LINE_PATTERN);
  if (stdMatch) {
    return [
      {
        item: stdMatch[1].trim(),
        qty: parseInt(stdMatch[2], 10),
        unit: mapUnit(stdMatch[3]),
        matched_product: null,
      },
    ];
  }

  // Try reversed pattern: "qty item"
  const revMatch = line.match(REVERSED_PATTERN);
  if (revMatch) {
    return [
      {
        item: revMatch[2].trim(),
        qty: parseInt(revMatch[1], 10),
        unit: mapUnit(revMatch[3]),
        matched_product: null,
      },
    ];
  }

  // Fallback to inline pattern
  const inlineFallback = parseInline(line);
  if (inlineFallback.length > 0) return inlineFallback;

  // Standalone item name (implicit qty=1)
  const standaloneMatch = line.match(STANDALONE_PATTERN);
  if (standaloneMatch) {
    return [
      {
        item: standaloneMatch[1].trim(),
        qty: 1,
        unit: "piece",
        matched_product: null,
      },
    ];
  }

  return [];
}

/**
 * Parse a Korean medical supply order message into structured items using
 * regex patterns. Works as a fast, offline fallback when the AI parser is
 * unavailable.
 */
export function regexParse(message: string): ParsedItem[] {
  if (!message || !message.trim()) return [];

  const lines = message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedItem[] = [];
  for (const line of lines) {
    results.push(...parseLine(line));
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. buildParsePrompt
// ---------------------------------------------------------------------------

interface AliasEntry {
  alias: string;
  product_name: string;
}

/** Build the few-shot examples section of the prompt. */
function buildFewShotSection(): string {
  const examples = FEW_SHOT_EXAMPLES.slice(0, 2);
  if (examples.length === 0) return "";

  const parts: string[] = ["\n## 파싱 예시"];
  for (const ex of examples) {
    parts.push(`\n입력: "${ex.input}"`);
    parts.push(`출력: ${JSON.stringify(ex.output)}`);
  }
  return parts.join("\n");
}

/**
 * Build a structured prompt for Claude to parse a hemodialysis medical supply
 * order message. Includes hospital-specific alias context and few-shot
 * examples.
 */
export function buildParsePrompt(
  hospitalName: string | null | undefined,
  aliases: AliasEntry[] | null | undefined,
  message: string,
): string {
  const aliasSection =
    aliases && aliases.length > 0
      ? `\n## 병원 별칭 목록 (${hospitalName})\n이 병원에서 사용하는 품목 약어입니다. 반드시 이 목록을 기준으로 매칭하세요:\n${aliases.map((a) => `- "${a.alias}" → ${a.product_name}`).join("\n")}\n`
      : "";

  const fewShotSection = buildFewShotSection();

  return `당신은 혈액투석 의료용품 주문 메시지를 파싱하는 전문가입니다.

## 핵심 규칙
1. 각 줄을 개별 주문 항목으로 파싱하세요.
2. 한 줄에 여러 품목이 있으면 각각 분리하세요 (예: "b 20 G 20" → 2개 항목).
3. 숫자가 없으면 수량을 1로 설정하세요.
4. 단위 매핑:
   - "박스", "box", "bx", "B" → unit: "box"
   - "개", "ea" → unit: "piece"
   - "팩", "pack" → unit: "pack"
   - 단위 없으면 → "piece"
5. **별칭 매칭이 최우선**: 별칭 목록에 정확히 일치하는 약어가 있으면 반드시 해당 제품으로 매칭하세요.
6. 단일 문자("b", "G", "A" 등)도 별칭 목록에 있으면 유효한 품목명입니다.
7. 영문+숫자 조합("EK15", "NV13")도 별칭 목록에 있으면 품목 코드입니다.
8. 인사말, 질문, 비주문 내용은 빈 배열 []로 반환하세요.
9. 별칭 목록에 없는 품목은 matched_product를 null로 설정하세요.
${aliasSection}${fewShotSection}
## 주문 메시지 (${hospitalName || "미확인"})
${message}

## 출력 형식 (JSON만 출력)
[
  { "item": "원문 약어", "qty": 수량, "unit": "box|piece|pack", "matched_product": "매칭된 정식 제품명 또는 null" }
]`;
}

// ---------------------------------------------------------------------------
// 3. matchProduct
// ---------------------------------------------------------------------------

/**
 * Look up the official product name by product_id from the products table.
 */
async function getProductName(
  productId: number | null,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!productId) return null;
  try {
    const { data } = await supabase
      .from("products")
      .select("official_name")
      .eq("id", productId)
      .single();
    return data?.official_name ?? null;
  } catch {
    return null;
  }
}

/** Level 1: Hospital-specific exact alias match (confidence 1.0). */
async function matchHospitalAlias(
  normalized: string,
  hospitalId: number,
  supabase: SupabaseClient,
): Promise<MatchResult | null> {
  const { data } = await supabase
    .from("product_aliases")
    .select("product_id")
    .eq("hospital_id", hospitalId)
    .eq("alias_normalized", normalized)
    .limit(1);

  if (data && data.length > 0) {
    const productName = await getProductName(data[0].product_id, supabase);
    return {
      product_id: data[0].product_id,
      product_name: productName,
      confidence: 1.0,
      method: "hospital_alias",
      match_status: "matched",
    };
  }
  return null;
}

/** Level 2: Global exact alias match (confidence 0.95). */
async function matchGlobalAlias(
  normalized: string,
  supabase: SupabaseClient,
): Promise<MatchResult | null> {
  const { data } = await supabase
    .from("product_aliases")
    .select("product_id")
    .is("hospital_id", null)
    .eq("alias_normalized", normalized)
    .limit(1);

  if (data && data.length > 0) {
    const productName = await getProductName(data[0].product_id, supabase);
    return {
      product_id: data[0].product_id,
      product_name: productName,
      confidence: 0.95,
      method: "global_alias",
      match_status: "matched",
    };
  }
  return null;
}

/** Level 3: Contains match on alias text (confidence 0.8-0.9). */
async function matchContains(
  normalized: string,
  hospitalId: number | null,
  supabase: SupabaseClient,
): Promise<MatchResult | null> {
  const { data } = await supabase
    .from("product_aliases")
    .select("product_id, hospital_id")
    .ilike("alias", `%${normalized}%`)
    .limit(5);

  if (!data || data.length === 0) return null;

  // Prefer hospital-specific matches
  if (hospitalId) {
    const hospitalMatch = data.find(
      (r: { product_id: number; hospital_id: number | null }) =>
        r.hospital_id === hospitalId,
    );
    if (hospitalMatch) {
      const productName = await getProductName(
        hospitalMatch.product_id,
        supabase,
      );
      return {
        product_id: hospitalMatch.product_id,
        product_name: productName,
        confidence: 0.9,
        method: "contains",
        match_status: "review",
      };
    }
  }

  const productName = await getProductName(data[0].product_id, supabase);
  return {
    product_id: data[0].product_id,
    product_name: productName,
    confidence: 0.8,
    method: "contains",
    match_status: "review",
  };
}

/** Level 4: Product name contains match (confidence 0.6). */
async function matchProductName(
  normalized: string,
  supabase: SupabaseClient,
): Promise<MatchResult | null> {
  const { data } = await supabase
    .from("products")
    .select("id, official_name")
    .or(`official_name.ilike.%${normalized}%,short_name.ilike.%${normalized}%`)
    .limit(1);

  if (data && data.length > 0) {
    return {
      product_id: data[0].id,
      product_name: data[0].official_name,
      confidence: 0.6,
      method: "name_contains",
      match_status: "review",
    };
  }
  return null;
}

/**
 * 5-level product matching against Supabase tables.
 *
 * Priority:
 * 1. Hospital-specific exact alias  (confidence 1.0)
 * 2. Global exact alias             (confidence 0.95)
 * 3. Contains match on alias        (confidence 0.8-0.9)
 * 4. Product name contains          (confidence 0.6)
 * 5. Unmatched                      (confidence 0)
 */
export async function matchProduct(
  text: string,
  hospitalId: number | null,
  supabase: SupabaseClient,
): Promise<MatchResult> {
  const normalized = normalize(text);
  let result: MatchResult | null = null;

  // Level 1: Hospital-specific exact alias
  if (hospitalId) {
    result = await matchHospitalAlias(normalized, hospitalId, supabase);
    if (result) return result;
  }

  // Level 2: Global exact alias
  result = await matchGlobalAlias(normalized, supabase);
  if (result) return result;

  // Level 3: Contains match on alias
  result = await matchContains(normalized, hospitalId, supabase);
  if (result) return result;

  // Level 4: Product name contains
  result = await matchProductName(normalized, supabase);
  if (result) return result;

  // Level 5: Unmatched
  return {
    product_id: null,
    product_name: null,
    confidence: 0,
    method: "unmatched",
    match_status: "unmatched",
    original_text: text,
  };
}

// ---------------------------------------------------------------------------
// 4. generateOrderNumber
// ---------------------------------------------------------------------------

/**
 * Generate a daily sequential order number in the format `ORD-YYYYMMDD-NNN`.
 */
export async function generateOrderNumber(
  supabase: SupabaseClient,
): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `ORD-${dateStr}`;

  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .like("order_number", `${prefix}%`);

  const seq = String((count || 0) + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

// ---------------------------------------------------------------------------
// 5. normalize
// ---------------------------------------------------------------------------

/**
 * Normalize text for matching: trim, lowercase, and collapse whitespace.
 */
export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
