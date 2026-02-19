/**
 * parse-message Edge Function
 *
 * Trigger: DB Webhook on raw_messages INSERT
 * Flow:
 *   1. Read AI settings from settings table
 *   2. If AI disabled or no API key → mark message as pending_manual
 *   3. Call AI (Claude / Gemini / OpenAI) with configured model + prompt
 *   4. Match products via 5-level matcher
 *   5. If auto_process=false OR low confidence → needs_review
 *   6. Otherwise → create order + order_items
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  callAI,
  resolveAIProvider,
} from "../_shared/ai-client.ts";
import {
  regexParse,
  buildParsePrompt,
  matchProductsBulk,
  generateOrderNumber,
  type ParsedItem,
  type BulkMatchedItem,
} from "../_shared/parser.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AISettings {
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  ai_api_key: string | null;
  ai_parse_prompt: string | null;
  ai_auto_process: boolean;
  ai_confidence_threshold: number;
}

// ---------------------------------------------------------------------------
// Settings keys to query
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

// ---------------------------------------------------------------------------
// Read AI settings from DB
// ---------------------------------------------------------------------------

async function getAISettings(
  supabase: ReturnType<typeof createClient>,
): Promise<AISettings> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", SETTINGS_KEYS);

  const map = new Map(
    (data ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  const resolved = resolveAIProvider(map);

  return {
    ai_enabled: map.get("ai_enabled") === true || map.get("ai_enabled") === "true",
    ai_provider: resolved?.provider ?? "anthropic",
    ai_model: resolved?.model ?? "claude-haiku-4-5-20251001",
    ai_api_key: resolved?.apiKey ?? null,
    ai_parse_prompt: (map.get("ai_parse_prompt") as string) ?? null,
    ai_auto_process: map.get("ai_auto_process") === true || map.get("ai_auto_process") === "true",
    ai_confidence_threshold: Number(map.get("ai_confidence_threshold") ?? 0.7),
  };
}

// ---------------------------------------------------------------------------
// Get hospital aliases for prompt context
// ---------------------------------------------------------------------------

async function getHospitalAliases(
  supabase: ReturnType<typeof createClient>,
  hospitalId: number,
): Promise<{ alias: string; product_name: string }[]> {
  const { data } = await supabase
    .from("product_aliases")
    .select("alias, product_id, products(official_name)")
    .or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);

  return (data ?? []).map(
    (a: { alias: string; products: { official_name: string } | null }) => ({
      alias: a.alias,
      product_name: a.products?.official_name ?? "",
    }),
  );
}

// ---------------------------------------------------------------------------
// AI parse — routes to the selected provider
// ---------------------------------------------------------------------------

async function aiParse(
  content: string,
  settings: AISettings,
  hospitalName: string | null,
  aliases: { alias: string; product_name: string }[],
): Promise<{
  items: ParsedItem[];
  method: "llm" | "regex";
  latencyMs: number;
  tokenUsage: { input_tokens: number; output_tokens: number } | null;
}> {
  const startTime = performance.now();

  if (!settings.ai_api_key || !settings.ai_enabled) {
    const items = regexParse(content);
    return {
      items,
      method: "regex",
      latencyMs: Math.round(performance.now() - startTime),
      tokenUsage: null,
    };
  }

  try {
    const prompt = settings.ai_parse_prompt
      ? `${settings.ai_parse_prompt}\n\n주문 메시지:\n${content}`
      : buildParsePrompt(hospitalName, aliases, content);

    const result = await callAI(
      settings.ai_provider,
      settings.ai_api_key,
      settings.ai_model,
      prompt,
    );

    const latencyMs = Math.round(performance.now() - startTime);

    if (!result.text) {
      return {
        items: regexParse(content),
        method: "regex",
        latencyMs,
        tokenUsage: {
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
        },
      };
    }

    // Extract JSON from response
    let jsonStr = result.text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    const items: ParsedItem[] = Array.isArray(parsed)
      ? parsed.map((item: Record<string, unknown>) => ({
          item: String(item.item ?? item.product_name ?? ""),
          qty: Number(item.qty ?? item.quantity ?? 1),
          unit: String(item.unit ?? "piece"),
          matched_product: item.matched_product
            ? String(item.matched_product)
            : null,
        }))
      : [];

    return {
      items,
      method: "llm",
      latencyMs,
      tokenUsage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      },
    };
  } catch (err) {
    console.error("AI parse failed, falling back to regex:", err);
    return {
      items: regexParse(content),
      method: "regex",
      latencyMs: Math.round(performance.now() - startTime),
      tokenUsage: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ------------------------------------------------------------------
    // 1. Parse the DB Webhook payload
    // ------------------------------------------------------------------
    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response(
        JSON.stringify({ error: "No record in webhook payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const messageId: number = record.id;
    const content: string = record.content;
    const hospitalId: number | null = record.hospital_id;
    const forceOrder: boolean = body.force_order === true;

    // ------------------------------------------------------------------
    // 2. Read AI settings
    // ------------------------------------------------------------------
    const settings = await getAISettings(supabase);

    // ------------------------------------------------------------------
    // 3. Get hospital info + aliases
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 5. Parse via AI (with regex fallback)
    // ------------------------------------------------------------------
    const parseResult = await aiParse(content, settings, hospitalName, aliases);

    if (parseResult.items.length === 0) {
      await supabase
        .from("raw_messages")
        .update({
          parse_status: "failed",
          parse_method: parseResult.method,
          is_order_message: false,
        })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({
          message_id: messageId,
          status: "no_items_parsed",
          method: parseResult.method,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // 6. Match products (bulk — 2 queries instead of N+1)
    // ------------------------------------------------------------------
    const matchedItems: BulkMatchedItem[] = await matchProductsBulk(
      supabase,
      parseResult.items,
      hospitalId,
    );

    // ------------------------------------------------------------------
    // 7. Log parse history
    // ------------------------------------------------------------------
    await supabase.from("parse_history").insert({
      message_id: messageId,
      parse_method: parseResult.method,
      llm_model: parseResult.method === "llm"
        ? `${settings.ai_provider}/${settings.ai_model}`
        : null,
      input_text: content,
      raw_output: parseResult.items,
      parsed_items: matchedItems.map((m) => ({
        item: m.parsed.item,
        qty: m.parsed.qty,
        unit: m.parsed.unit,
        product_id: m.match.product_id,
        product_name: m.match.product_name,
        confidence: m.match.confidence,
        match_status: m.match.match_status,
      })),
      latency_ms: parseResult.latencyMs,
      token_usage: parseResult.tokenUsage,
    });

    // ------------------------------------------------------------------
    // 8. Check auto-process conditions
    // ------------------------------------------------------------------
    const minConfidence = Math.min(
      ...matchedItems.map((m) => m.match.confidence),
    );
    const hasUnmatched = matchedItems.some(
      (m) => m.match.match_status === "unmatched",
    );
    const shouldAutoCreate =
      hospitalId != null && // orders.hospital_id is NOT NULL — guard against constraint violation
      (forceOrder || (
        settings.ai_auto_process &&
        !hasUnmatched &&
        minConfidence >= settings.ai_confidence_threshold
      ));

    if (!shouldAutoCreate) {
      // Mark message as needs_review
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

      return new Response(
        JSON.stringify({
          message_id: messageId,
          status: "needs_review",
          items: matchedItems.length,
          min_confidence: minConfidence,
          has_unmatched: hasUnmatched,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // 9. Auto-create order + order_items
    // ------------------------------------------------------------------
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
      console.error("Failed to create order:", orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order", details: orderError }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Insert order items
    const orderItems = matchedItems.map((m) => ({
      order_id: order.id,
      product_id: m.match.product_id,
      original_text: m.parsed.item,
      quantity: m.parsed.qty,
      unit_type: m.parsed.unit,
      match_status: m.match.match_status,
      match_confidence: m.match.confidence,
    }));

    await supabase.from("order_items").insert(orderItems);

    // Update raw_message with order link
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

    return new Response(
      JSON.stringify({
        message_id: messageId,
        status: "order_created",
        order_id: order.id,
        order_number: orderNumber,
        items: matchedItems.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("parse-message unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
