/**
 * Parser Module (Node.js port of packages/supabase/functions/_shared/parser.ts)
 *
 * Korean medical supply order text parser with:
 * - regexParse: regex-based item extraction
 * - buildParsePrompt: AI prompt builder with hospital aliases
 * - matchProductsBulk: 5-level product matching (bulk, 2 queries)
 * - generateOrderNumber: daily sequential order numbers
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface BulkMatchedItem {
  parsed: ParsedItem;
  match: MatchResult;
}

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNIT_MAP: Record<string, string> = {
  "박스": "box", "box": "box", "bx": "box",
  "개": "piece", "ea": "piece", "piece": "piece",
  "봉": "pack", "팩": "pack", "pack": "pack",
  "세트": "set", "set": "set",
  "병": "bottle", "통": "can", "캔": "can",
  "매": "sheet", "장": "sheet", "롤": "roll",
};

const UNIT_REGEX = "박스|box|bx|개|ea|봉|팩|pack|세트|set|병|통|캔|매|장|롤";

const LINE_PATTERN = new RegExp(
  `^([가-힣A-Za-z][\\w가-힣A-Za-z\\-\\/\\.\\s]*?)\\s+(\\d+)\\s*(${UNIT_REGEX})?\\s*$`,
  "i",
);

const REVERSED_PATTERN = new RegExp(
  `^(\\d+)\\s+([\\w가-힣A-Za-z\\-\\/\\.]+(?:\\s+[\\w가-힣A-Za-z\\-\\/\\.]+)*?)\\s*(${UNIT_REGEX})?\\s*$`,
  "i",
);

const INLINE_PATTERN = new RegExp(
  `([\\w가-힣A-Za-z\\-\\/\\.]+)\\s+(\\d+)\\s*(${UNIT_REGEX})?`,
  "gi",
);

const STANDALONE_PATTERN = /^([가-힣A-Za-z][\w가-힣A-Za-z\-\/\.]*)\s*$/;

const NON_ORDER_PATTERNS: RegExp[] = [
  /^(감사|안녕|수고|죄송|네|예|좋|확인|알겠)/,
  /\?$/,
  /^(오늘|내일|어제|지금|다음)\s/,
  /회의|미팅|연락|전화|문의/,
];

// ---------------------------------------------------------------------------
// Few-shot examples
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

// ---------------------------------------------------------------------------
// 1. regexParse
// ---------------------------------------------------------------------------

function mapUnit(raw: string | undefined | null): string {
  if (!raw) return "piece";
  return UNIT_MAP[raw.toLowerCase()] || "piece";
}

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

function parseLine(line: string): ParsedItem[] {
  for (const pattern of NON_ORDER_PATTERNS) {
    if (pattern.test(line)) return [];
  }

  const tokens = line.split(/\s+/);
  const numberTokenCount = tokens.filter((t) =>
    /^\d+(박스|box|bx|개|ea|팩|pack)?$/i.test(t)
  ).length;

  if (numberTokenCount >= 2) {
    const inlineResults = parseInline(line);
    if (inlineResults.length >= 2) return inlineResults;
  }

  const stdMatch = line.match(LINE_PATTERN);
  if (stdMatch) {
    return [{
      item: stdMatch[1].trim(),
      qty: parseInt(stdMatch[2], 10),
      unit: mapUnit(stdMatch[3]),
      matched_product: null,
    }];
  }

  const revMatch = line.match(REVERSED_PATTERN);
  if (revMatch) {
    return [{
      item: revMatch[2].trim(),
      qty: parseInt(revMatch[1], 10),
      unit: mapUnit(revMatch[3]),
      matched_product: null,
    }];
  }

  const inlineFallback = parseInline(line);
  if (inlineFallback.length > 0) return inlineFallback;

  const standaloneMatch = line.match(STANDALONE_PATTERN);
  if (standaloneMatch) {
    return [{
      item: standaloneMatch[1].trim(),
      qty: 1,
      unit: "piece",
      matched_product: null,
    }];
  }

  return [];
}

export function regexParse(message: string): ParsedItem[] {
  if (!message || !message.trim()) return [];
  const lines = message.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: ParsedItem[] = [];
  for (const line of lines) {
    results.push(...parseLine(line));
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. buildParsePrompt
// ---------------------------------------------------------------------------

interface AliasEntry { alias: string; product_name: string; }

export interface ProductCatalogEntry {
  official_name: string;
  short_name: string | null;
}

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

/** System prompt: static rules, unit table, schema. */
export function buildSystemPrompt(): string {
  return `당신은 혈액투석 의료용품 주문 메시지를 파싱하는 전문가입니다.

## 핵심 규칙
1. 각 줄을 개별 주문 항목으로 파싱하세요.
2. 한 줄에 여러 품목이 있으면 각각 분리하세요 (예: "b 20 G 20" → 2개 항목).
3. 숫자가 없으면 수량을 1로 설정하세요.
4. 단위 매핑:
   - "박스", "box", "bx", "B" → unit: "box"
   - "개", "ea" → unit: "piece"
   - "팩", "pack", "봉" → unit: "pack"
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
  "is_order": boolean,
  "items": [
    {
      "item": "원문 약어",
      "qty": 수량(정수, 최소 1),
      "unit": "box|piece|pack|set|bottle|can|sheet|roll",
      "matched_product": "매칭된 정식 제품명 또는 null",
      "confidence": 0.0~1.0
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

export function buildParsePrompt(
  hospitalName: string | null | undefined,
  aliases: AliasEntry[] | null | undefined,
  message: string,
  products?: ProductCatalogEntry[] | null,
): string {
  return `${buildSystemPrompt()}\n\n${buildUserPrompt(hospitalName, aliases, message, products)}`;
}

// ---------------------------------------------------------------------------
// 3. matchProductsBulk
// ---------------------------------------------------------------------------

export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

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

    // Level 5: Unmatched
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

// ---------------------------------------------------------------------------
// 4. generateOrderNumber
// ---------------------------------------------------------------------------

export async function generateOrderNumber(supabase: SupabaseClient): Promise<string> {
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
