/**
 * Parse Service — reusable parse pipeline for both server actions and API routes.
 *
 * Exports:
 *   - getHospitalAliases(supabase, hospitalId)
 *   - aiParse(content, settings, hospitalName, aliases, products)
 *   - parseMessageCore(supabase, settings, messageId, content, hospitalId, forceOrder)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAI, callAIStructured } from "@/lib/ai-client";
import type { AISettings } from "@/lib/ai-client";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParseMessageResult {
  message_id: number;
  status: string;
  order_id?: number;
  items?: number;
  warnings?: string[];
  data?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// resolveHospitalFromSender — auto-match sender name to hospital
// ---------------------------------------------------------------------------

export async function resolveHospitalFromSender(
  supabase: SupabaseClient,
  sender: string | null | undefined,
): Promise<{ id: number; name: string } | null> {
  if (!sender || sender.trim().length === 0) return null;

  const term = sender.trim();

  // Exact match on name or short_name
  const { data: exact } = await supabase
    .from("hospitals")
    .select("id, name")
    .or(`name.eq.${term},short_name.eq.${term}`)
    .limit(1);

  if (exact && exact.length > 0) return exact[0];

  // Contains match (sender contains hospital name or vice versa)
  const { data: all } = await supabase
    .from("hospitals")
    .select("id, name, short_name");

  const termLower = term.toLowerCase();
  for (const h of all ?? []) {
    const nameLower = h.name.toLowerCase();
    const shortLower = (h.short_name ?? "").toLowerCase();
    if (
      nameLower.includes(termLower) || termLower.includes(nameLower) ||
      (shortLower && (shortLower.includes(termLower) || termLower.includes(shortLower)))
    ) {
      return { id: h.id, name: h.name };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// getHospitalAliases
// ---------------------------------------------------------------------------

export async function getHospitalAliases(
  _supabase: SupabaseClient,
  _hospitalId: number,
): Promise<{ alias: string; product_name: string }[]> {
  // product_aliases table has been dropped — alias matching is no longer available.
  // Return empty array so callers continue to work without aliases.
  return [];
}

// ---------------------------------------------------------------------------
// aiParse
// ---------------------------------------------------------------------------

export async function aiParse(
  content: string,
  settings: AISettings,
  hospitalName: string | null,
  aliases: { alias: string; product_name: string }[],
  products: ProductCatalogEntry[],
): Promise<ParseResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  // No API key or AI disabled → regex fallback
  if (!settings.ai_api_key || !settings.ai_enabled) {
    console.log(`[aiParse] No API key or AI disabled → regex fallback | hasKey=${!!settings.ai_api_key} enabled=${settings.ai_enabled}`);
    warnings.push("AI disabled or no API key — used regex fallback");
    const items = regexParse(content);
    console.log(`[aiParse] regex result: ${items.length} items`);
    return {
      items,
      method: "regex",
      latency_ms: Math.round(performance.now() - startTime),
      warnings,
    };
  }

  try {
    const useCustomPrompt = !!settings.ai_parse_prompt;

    if (useCustomPrompt) {
      // ---- Legacy path: custom prompt override → callAI (single prompt, text) ----
      const prompt = `${settings.ai_parse_prompt}\n\n주문 메시지:\n${content}`;
      console.log(`[aiParse] customPrompt=true | prompt length=${prompt.length}`);
      console.log(`[aiParse] Calling ${settings.ai_provider}/${settings.ai_model} (legacy callAI)...`);

      const result = await callAI(
        settings.ai_provider,
        settings.ai_api_key,
        settings.ai_model,
        prompt,
      );

      const latency_ms = Math.round(performance.now() - startTime);
      console.log(`[aiParse] AI response: ${result.text.length} chars | tokens: in=${result.inputTokens} out=${result.outputTokens} | ${latency_ms}ms`);

      if (!result.text) {
        warnings.push("AI returned empty response — used regex fallback");
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

      console.log(`[aiParse] Parsed ${items.length} items from AI response (legacy)`);

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

    // ---- Default path: structured output → callAIStructured ----
    const system = buildSystemPrompt();
    const user = buildUserPrompt(hospitalName, aliases, content, products);

    console.log(`[aiParse] customPrompt=false | system=${system.length} chars | user=${user.length} chars`);
    console.log(`[aiParse] Calling ${settings.ai_provider}/${settings.ai_model} (structured)...`);

    const result = await callAIStructured(
      settings.ai_provider,
      settings.ai_api_key,
      settings.ai_model,
      system,
      user,
    );

    const latency_ms = Math.round(performance.now() - startTime);
    console.log(`[aiParse] Structured response | tokens: in=${result.inputTokens} out=${result.outputTokens} | ${latency_ms}ms`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.parsed as any;

    if (!data) {
      warnings.push("AI structured output returned null — used regex fallback");
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

    // Non-order detection
    if (data.is_order === false) {
      console.log(`[aiParse] AI classified as non-order: ${data.rejection_reason ?? "no reason"}`);
      warnings.push(`AI classified as non-order: ${data.rejection_reason ?? "unknown reason"}`);
      return {
        items: [],
        method: "llm",
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        latency_ms,
        token_usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
        warnings,
      };
    }

    // Map data.items → ParsedItem[]
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items: ParsedItem[] = rawItems.map((item: Record<string, unknown>) => ({
      item: String(item.item ?? ""),
      qty: Number(item.qty ?? 1),
      unit: String(item.unit ?? "piece"),
      matched_product: item.matched_product ? String(item.matched_product) : null,
    }));

    console.log(`[aiParse] Parsed ${items.length} items from structured AI response`);

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
    console.error("[aiParse] AI parse failed, falling back to regex:", err);
    warnings.push(`AI parse error: ${err instanceof Error ? err.message : String(err)} — used regex fallback`);
    const items = regexParse(content);
    console.log(`[aiParse] regex fallback: ${items.length} items`);
    return {
      items,
      method: "regex",
      latency_ms: Math.round(performance.now() - startTime),
      warnings,
    };
  }
}

// ---------------------------------------------------------------------------
// parseMessageCore — full pipeline (parse + match + DB writes)
// ---------------------------------------------------------------------------

export async function parseMessageCore(
  supabase: SupabaseClient,
  settings: AISettings,
  messageId: number,
  content: string,
  hospitalId: number | null,
  forceOrder: boolean,
): Promise<ParseMessageResult> {
  console.log(`[parseMessage] id=${messageId} | ai_enabled=${settings.ai_enabled} | provider=${settings.ai_provider} | model=${settings.ai_model} | hasApiKey=${!!settings.ai_api_key} | hospitalId=${hospitalId}`);

  // Get hospital info + aliases
  let hospitalName: string | null = null;
  let aliases: { alias: string; product_name: string }[] = [];

  if (hospitalId) {
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", hospitalId)
      .single();
    hospitalName = hospital?.name ?? null;
    aliases = await getHospitalAliases(supabase, hospitalId);
  }

  // Load product catalog for AI context
  const { data: productRows } = await supabase
    .from("products_catalog")
    .select("official_name, short_name")
    .eq("is_active", true);

  const products: ProductCatalogEntry[] = (productRows ?? []).map(
    (p: { official_name: string; short_name: string | null }) => ({
      official_name: p.official_name,
      short_name: p.short_name,
    }),
  );

  console.log(`[parseMessage] id=${messageId} | hospital=${hospitalName} | aliases=${aliases.length}개 | products=${products.length}개 | content="${content.slice(0, 80)}..."`);

  // Parse via AI (with regex fallback)
  const parseResult = await aiParse(content, settings, hospitalName, aliases, products);

  console.log(`[parseMessage] id=${messageId} | method=${parseResult.method} | items=${parseResult.items.length} | latency=${parseResult.latency_ms}ms`);
  if (parseResult.items.length > 0) {
    console.log(`[parseMessage] id=${messageId} | parsed items:`, JSON.stringify(parseResult.items));
  }

  if (parseResult.items.length === 0) {
    console.log(`[parseMessage] id=${messageId} | NO ITEMS PARSED → failed`);
    await supabase
      .from("raw_messages")
      .update({
        parse_status: "failed",
        parse_method: parseResult.method,
        is_order_message: false,
      })
      .eq("id", messageId);
    return {
      message_id: messageId,
      status: "no_items_parsed",
      items: 0,
      warnings: parseResult.warnings,
    };
  }

  // Match products (bulk)
  const matchedItems: BulkMatchedItem[] = await matchProductsBulk(supabase, parseResult.items, hospitalId);

  // Log parse history (store warnings in raw_output)
  await supabase.from("parse_history").insert({
    message_id: messageId,
    parse_method: parseResult.method,
    llm_model: parseResult.method === "llm"
      ? `${settings.ai_provider}/${settings.ai_model}`
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

  // Check auto-process conditions
  const minConfidence = Math.min(...matchedItems.map((m) => m.match.confidence));
  const hasUnmatched = matchedItems.some((m) => m.match.match_status === "unmatched");
  const shouldAutoCreate =
    hospitalId != null &&
    (forceOrder || (
      settings.ai_auto_process &&
      !hasUnmatched &&
      minConfidence >= settings.ai_confidence_threshold
    ));

  if (!shouldAutoCreate) {
    await supabase
      .from("raw_messages")
      .update({
        parse_status: "parsed",
        parse_method: parseResult.method,
        parse_result: matchedItems.map((m) => ({
          item: m.parsed.item,
          qty: m.parsed.qty,
          unit: m.parsed.unit,
          product_id: m.match.product_id,
          product_name: m.match.product_name,
          confidence: m.match.confidence,
          match_status: m.match.match_status,
        })),
        is_order_message: true,
      })
      .eq("id", messageId);
    return {
      message_id: messageId,
      status: "needs_review",
      items: matchedItems.length,
      warnings: parseResult.warnings,
    };
  }

  // Auto-create order + order_items
  const orderNumber = await generateOrderNumber(supabase);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: new Date().toISOString().slice(0, 10),
      hospital_id: hospitalId,
      message_id: messageId,
      status: "draft",
      total_items: matchedItems.length,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw new Error(`주문 생성 실패: ${orderError?.message ?? "Unknown error"}`);
  }

  // Look up default box specs for matched products
  const productIds = matchedItems
    .map((m) => m.match.product_id)
    .filter((id): id is number => id != null);

  const boxSpecMap = new Map<number, { id: number; qty_per_box: number }>();
  if (productIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_box_specs")
      .select("id, product_id, qty_per_box")
      .in("product_id", productIds)
      .eq("is_default", true);
    for (const s of specs ?? []) {
      boxSpecMap.set(s.product_id, { id: s.id, qty_per_box: s.qty_per_box });
    }
  }

  const orderItems = matchedItems.map((m) => {
    const spec = m.match.product_id ? boxSpecMap.get(m.match.product_id) : undefined;
    const calculatedPieces = spec
      ? (m.parsed.unit === "box" ? m.parsed.qty * spec.qty_per_box : m.parsed.qty)
      : m.parsed.qty;

    return {
      order_id: order.id,
      product_id: m.match.product_id,
      original_text: m.parsed.item,
      quantity: m.parsed.qty,
      unit_type: m.parsed.unit,
      box_spec_id: spec?.id ?? null,
      calculated_pieces: calculatedPieces,
      match_status: m.match.match_status,
      match_confidence: m.match.confidence,
    };
  });

  await supabase.from("order_items").insert(orderItems);

  await supabase
    .from("raw_messages")
    .update({
      parse_status: "parsed",
      parse_method: parseResult.method,
      parse_result: matchedItems.map((m) => ({
        item: m.parsed.item,
        qty: m.parsed.qty,
        unit: m.parsed.unit,
        product_id: m.match.product_id,
        product_name: m.match.product_name,
        confidence: m.match.confidence,
      })),
      order_id: order.id,
      is_order_message: true,
    })
    .eq("id", messageId);

  return {
    message_id: messageId,
    status: "order_created",
    order_id: order.id,
    items: matchedItems.length,
    warnings: parseResult.warnings,
  };
}

// ---------------------------------------------------------------------------
// getAISettingsFromClient — load AI settings using a provided Supabase client
// (For API routes where the session-based getAISettings() won't work)
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
    case "openai": return "gpt-4.1-mini";
    default: return "claude-haiku-4-5-20251001";
  }
}

export async function getAISettingsFromClient(supabase: SupabaseClient): Promise<AISettings> {
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
