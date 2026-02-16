/**
 * parse-message Edge Function
 *
 * Trigger: DB Webhook on raw_messages INSERT
 * Flow:
 *   1. Read AI settings from settings table
 *   2. If AI disabled → mark message as pending_manual
 *   3. Call Claude API with configured model + prompt
 *   4. Match products via 5-level matcher
 *   5. If auto_process=false OR low confidence → needs_review
 *   6. Otherwise → create order + order_items
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import {
  regexParse,
  buildParsePrompt,
  matchProduct,
  generateOrderNumber,
  normalize,
  type ParsedItem,
  type MatchResult,
} from "../_shared/parser.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AISettings {
  ai_enabled: boolean;
  ai_model: string;
  ai_parse_prompt: string | null;
  ai_auto_process: boolean;
  ai_confidence_threshold: number;
}

interface MatchedOrderItem {
  parsed: ParsedItem;
  match: MatchResult;
}

// ---------------------------------------------------------------------------
// Read AI settings from DB
// ---------------------------------------------------------------------------

async function getAISettings(
  supabase: ReturnType<typeof createClient>,
): Promise<AISettings> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "ai_enabled",
      "ai_model",
      "ai_parse_prompt",
      "ai_auto_process",
      "ai_confidence_threshold",
    ]);

  const map = new Map(
    (data ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  return {
    ai_enabled: map.get("ai_enabled") === true || map.get("ai_enabled") === "true",
    ai_model: (typeof map.get("ai_model") === "string"
      ? (map.get("ai_model") as string).replace(/^"|"$/g, "")
      : "claude-haiku-4-5-20251001"),
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
// AI parse via Claude
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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || !settings.ai_enabled) {
    const items = regexParse(content);
    return {
      items,
      method: "regex",
      latencyMs: Math.round(performance.now() - startTime),
      tokenUsage: null,
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const prompt = settings.ai_parse_prompt
      ? `${settings.ai_parse_prompt}\n\n주문 메시지:\n${content}`
      : buildParsePrompt(hospitalName, aliases, content);

    const response = await anthropic.messages.create({
      model: settings.ai_model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const latencyMs = Math.round(performance.now() - startTime);
    const textBlock = response.content.find(
      (block: { type: string }) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      return {
        items: regexParse(content),
        method: "regex",
        latencyMs,
        tokenUsage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
      };
    }

    // Extract JSON from response
    let jsonStr = textBlock.text.trim();
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
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
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

    // ------------------------------------------------------------------
    // 2. Read AI settings
    // ------------------------------------------------------------------
    const settings = await getAISettings(supabase);

    // ------------------------------------------------------------------
    // 3. If AI disabled → mark as pending_manual
    // ------------------------------------------------------------------
    if (!settings.ai_enabled) {
      await supabase
        .from("raw_messages")
        .update({ parse_status: "pending", parse_method: "manual" })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ message_id: messageId, status: "pending_manual" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // 4. Get hospital info + aliases
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
    // 6. Match products
    // ------------------------------------------------------------------
    const matchedItems: MatchedOrderItem[] = [];

    for (const parsed of parseResult.items) {
      const match = await matchProduct(parsed.item, hospitalId, supabase);
      matchedItems.push({ parsed, match });
    }

    // ------------------------------------------------------------------
    // 7. Log parse history
    // ------------------------------------------------------------------
    await supabase.from("parse_history").insert({
      message_id: messageId,
      parse_method: parseResult.method,
      llm_model: parseResult.method === "llm" ? settings.ai_model : null,
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
      settings.ai_auto_process &&
      !hasUnmatched &&
      minConfidence >= settings.ai_confidence_threshold;

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
        status: "pending",
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
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
