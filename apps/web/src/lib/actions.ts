"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateId } from "@/lib/schedule-utils";
import type { ProductAlias } from "@/lib/types";
import { callAI, getAISettings } from "@/lib/ai-client";
import {
  regexParse,
  buildParsePrompt,
  matchProductsBulk,
  generateOrderNumber,
  type ParsedItem,
  type BulkMatchedItem,
} from "@/lib/parser";

// --- Products ---

export async function createProduct(data: {
  official_name: string;
  short_name?: string;
  category?: string;
  manufacturer?: string;
  ingredient?: string;
  efficacy?: string;
  standard_code?: string;
  unit?: string;
  unit_price?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ...data,
    name: data.official_name,
  });
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function updateProduct(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProducts(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

// --- Hospitals ---

export async function createHospital(data: {
  name: string;
  short_name?: string;
  hospital_type?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  business_number?: string;
  payment_terms?: string;
  lead_time_days?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").insert(data);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function updateHospital(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function deleteHospital(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function deleteHospitals(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

// --- Product Aliases ---

export async function getProductAliases(productId: number): Promise<ProductAlias[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_aliases")
    .select("*")
    .eq("product_id", productId)
    .order("id");
  if (error) throw error;
  return (data ?? []) as ProductAlias[];
}

export async function createProductAlias(productId: number, data: {
  alias: string;
  hospital_id?: number | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_aliases")
    .insert({ product_id: productId, ...data });
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function updateProductAlias(_productId: number, aliasId: number, data: {
  alias?: string;
  hospital_id?: number | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_aliases")
    .update(data)
    .eq("id", aliasId);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProductAlias(_productId: number, aliasId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_aliases")
    .delete()
    .eq("id", aliasId);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

// --- Orders ---

export async function deleteOrder(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateOrder(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

// --- Messages ---

export async function createMessage(data: {
  source_app: string;
  sender?: string;
  content: string;
  device_name?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").insert({
    source_app: data.source_app,
    sender: data.sender || null,
    content: data.content,
    device_name: data.device_name || null,
    received_at: new Date().toISOString(),
    parse_status: "pending",
  });
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMessage(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMessage(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Direct parse-message logic (replaces Edge Function call)
// ---------------------------------------------------------------------------

async function getHospitalAliases(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

async function aiParse(
  content: string,
  settings: Awaited<ReturnType<typeof getAISettings>>,
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
    console.log(`[aiParse] No API key or AI disabled → regex fallback | hasKey=${!!settings.ai_api_key} enabled=${settings.ai_enabled}`);
    const items = regexParse(content);
    console.log(`[aiParse] regex result: ${items.length} items`);
    return {
      items,
      method: "regex",
      latencyMs: Math.round(performance.now() - startTime),
      tokenUsage: null,
    };
  }

  try {
    const useCustomPrompt = !!settings.ai_parse_prompt;
    const prompt = settings.ai_parse_prompt
      ? `${settings.ai_parse_prompt}\n\n주문 메시지:\n${content}`
      : buildParsePrompt(hospitalName, aliases, content);

    console.log(`[aiParse] customPrompt=${useCustomPrompt} | prompt length=${prompt.length}`);
    console.log(`[aiParse] PROMPT START >>>>\n${prompt.slice(0, 800)}\n<<<< PROMPT END`);
    console.log(`[aiParse] Calling ${settings.ai_provider}/${settings.ai_model}...`);

    const result = await callAI(
      settings.ai_provider,
      settings.ai_api_key,
      settings.ai_model,
      prompt,
    );

    const latencyMs = Math.round(performance.now() - startTime);
    console.log(`[aiParse] AI response: ${result.text.length} chars | tokens: in=${result.inputTokens} out=${result.outputTokens} | ${latencyMs}ms`);
    console.log(`[aiParse] AI raw text: ${result.text.slice(0, 500)}`);

    if (!result.text) {
      console.log(`[aiParse] Empty AI response → regex fallback`);
      return {
        items: regexParse(content),
        method: "regex",
        latencyMs,
        tokenUsage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
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

    console.log(`[aiParse] Parsed ${items.length} items from AI response`);

    return {
      items,
      method: "llm",
      latencyMs,
      tokenUsage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
    };
  } catch (err) {
    console.error("[aiParse] AI parse failed, falling back to regex:", err);
    const items = regexParse(content);
    console.log(`[aiParse] regex fallback: ${items.length} items`);
    return {
      items,
      method: "regex",
      latencyMs: Math.round(performance.now() - startTime),
      tokenUsage: null,
    };
  }
}

async function parseMessageDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: number,
  content: string,
  hospitalId: number | null,
  forceOrder: boolean,
): Promise<{ message_id: number; status: string; order_id?: number; items?: number }> {
  const settings = await getAISettings();

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

  console.log(`[parseMessage] id=${messageId} | hospital=${hospitalName} | aliases=${aliases.length}개 | content="${content.slice(0, 80)}..."`);

  // Parse via AI (with regex fallback)
  const parseResult = await aiParse(content, settings, hospitalName, aliases);

  console.log(`[parseMessage] id=${messageId} | method=${parseResult.method} | items=${parseResult.items.length} | latency=${parseResult.latencyMs}ms`);
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
    return { message_id: messageId, status: "no_items_parsed", items: 0 };
  }

  // Match products (bulk)
  const matchedItems: BulkMatchedItem[] = await matchProductsBulk(supabase, parseResult.items, hospitalId);

  // Log parse history
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
    return { message_id: messageId, status: "needs_review", items: matchedItems.length };
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

  return { message_id: messageId, status: "order_created", order_id: order.id, items: matchedItems.length };
}

export async function reparseMessage(id: number, hospitalId?: number) {
  const supabase = await createClient();

  // If hospitalId provided, update the message first
  if (hospitalId) {
    const { error: updErr } = await supabase
      .from("raw_messages")
      .update({ hospital_id: hospitalId })
      .eq("id", id);
    if (updErr) throw updErr;
  }

  const { data: msg, error: fetchErr } = await supabase
    .from("raw_messages")
    .select("id, content, hospital_id")
    .eq("id", id)
    .single();
  if (fetchErr || !msg) throw fetchErr ?? new Error("메시지를 찾을 수 없습니다.");

  const result = await parseMessageDirect(supabase, msg.id, msg.content, msg.hospital_id, true);
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return result;
}

export async function reparseMessages(ids: number[], hospitalId?: number) {
  if (ids.length === 0) return { success: true, results: [] };
  const supabase = await createClient();

  // If hospitalId provided, update messages that don't have one
  if (hospitalId) {
    const { data: noHospital } = await supabase
      .from("raw_messages")
      .select("id")
      .in("id", ids)
      .is("hospital_id", null);
    const noHospitalIds = (noHospital ?? []).map((m) => m.id);
    if (noHospitalIds.length > 0) {
      const { error: updErr } = await supabase
        .from("raw_messages")
        .update({ hospital_id: hospitalId })
        .in("id", noHospitalIds);
      if (updErr) throw updErr;
    }
  }

  const { data: msgs, error: fetchErr } = await supabase
    .from("raw_messages")
    .select("id, content, hospital_id")
    .in("id", ids);
  if (fetchErr) throw fetchErr;

  const results = [];
  for (const msg of msgs ?? []) {
    try {
      const data = await parseMessageDirect(supabase, msg.id, msg.content, msg.hospital_id, true);
      results.push({ id: msg.id, data, error: null });
    } catch (err) {
      results.push({ id: msg.id, data: null, error: (err as Error).message });
    }
  }
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true, results };
}

export async function deleteMessages(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

// --- Suppliers ---

export async function createSupplier(data: {
  name: string;
  short_name?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert(data);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function updateSupplier(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function deleteSuppliers(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

// --- Mobile Devices ---

export async function updateDevice(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("mobile_devices").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/devices");
  return { success: true };
}

export async function requestDeviceSync(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("trigger-sync", {
    body: { device_id: id },
  });
  if (error) {
    return { success: false, error: error.message ?? "동기화 요청 실패", fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  revalidatePath("/devices");
  revalidatePath("/dashboard");
  return data as { success: boolean; fcm_sent: number; fcm_failed: number; realtime_updated: number };
}

export async function requestAllDevicesSync() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("trigger-sync", {
    body: { device_id: "all" },
  });
  if (error) {
    return { success: false, error: error.message ?? "동기화 요청 실패", fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  revalidatePath("/devices");
  revalidatePath("/dashboard");
  return data as { success: boolean; fcm_sent: number; fcm_failed: number; realtime_updated: number };
}

// --- Users (via manage-users Edge Function) ---

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    method: "POST",
    body: data,
  });
  if (error) {
    return { error: result?.error ?? error.message ?? "사용자 생성 실패" };
  }
  revalidatePath("/users");
  return result;
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    method: "PATCH",
    body: { id, ...data },
  });
  if (error) {
    return { error: result?.error ?? error.message ?? "사용자 수정 실패" };
  }
  revalidatePath("/users");
  return result;
}

export async function deleteUser(id: string) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    method: "DELETE",
    body: { id },
  });
  if (error) {
    return { error: result?.error ?? error.message ?? "사용자 비활성화 실패" };
  }
  revalidatePath("/users");
  return result;
}

// --- Schedule: Plans ---

export async function createPlan(data: {
  category_id: string;
  date: number;
  title: string;
  order_index?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("plans").insert({
    id: generateId(),
    user_id: user.id,
    category_id: data.category_id,
    date: data.date,
    title: data.title,
    is_completed: false,
    order_index: data.order_index ?? 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePlan(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ ...data, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function togglePlanCompletion(id: string, isCompleted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_completed: isCompleted, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_deleted: true, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function linkPlanToMessage(planId: string, messageId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ linked_message_id: messageId, updated_at: Date.now() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePlanOrderNumber(planId: string, orderNumber: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ order_number: orderNumber, updated_at: Date.now() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

// --- Schedule: Day Categories ---

export async function addCategoryToDay(date: number, categoryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("day_categories").insert({
    id: generateId(),
    user_id: user.id,
    date,
    category_id: categoryId,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function removeCategoryFromDay(dayCategoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("day_categories")
    .delete()
    .eq("id", dayCategoryId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

// --- Schedule: Week Operations ---

export async function addAllCategoriesToWeek(weekStartMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("is_deleted", false)
    .eq("is_active", true);

  if (!categories || categories.length === 0) return { success: true };

  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const { data: existing } = await supabase
    .from("day_categories")
    .select("date, category_id")
    .gte("date", weekStartMs)
    .lt("date", weekEndMs);

  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.date}-${e.category_id}`)
  );

  const now = Date.now();
  const toInsert: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 7; i++) {
    const dayMs = weekStartMs + i * 24 * 60 * 60 * 1000;
    for (const cat of categories) {
      if (!existingSet.has(`${dayMs}-${cat.id}`)) {
        toInsert.push({
          id: generateId(),
          user_id: user.id,
          date: dayMs,
          category_id: cat.id,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("day_categories").insert(toInsert);
    if (error) throw error;
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function copyPreviousWeekPlans(targetWeekStartMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const sourceWeekStartMs = targetWeekStartMs - 7 * 24 * 60 * 60 * 1000;
  const sourceWeekEndMs = targetWeekStartMs;
  const now = Date.now();

  // Copy day_categories
  const { data: srcDayCats } = await supabase
    .from("day_categories")
    .select("*")
    .gte("date", sourceWeekStartMs)
    .lt("date", sourceWeekEndMs);

  if (srcDayCats && srcDayCats.length > 0) {
    const dcInsert = srcDayCats.map((dc) => ({
      id: generateId(),
      user_id: user.id,
      date: dc.date + 7 * 24 * 60 * 60 * 1000,
      category_id: dc.category_id,
      created_at: now,
      updated_at: now,
    }));
    await supabase.from("day_categories").upsert(dcInsert, { onConflict: "id" });
  }

  // Copy plans
  const { data: srcPlans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_deleted", false)
    .gte("date", sourceWeekStartMs)
    .lt("date", sourceWeekEndMs);

  if (srcPlans && srcPlans.length > 0) {
    const planInsert = srcPlans.map((p) => ({
      id: generateId(),
      user_id: user.id,
      category_id: p.category_id,
      date: p.date + 7 * 24 * 60 * 60 * 1000,
      title: p.title,
      is_completed: false,
      linked_message_id: null,
      order_number: null,
      order_index: p.order_index,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    }));
    await supabase.from("plans").insert(planInsert);
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function copyCurrentWeekToNext(sourceWeekStartMs: number) {
  const targetWeekStartMs = sourceWeekStartMs + 7 * 24 * 60 * 60 * 1000;
  return copyPreviousWeekPlans(targetWeekStartMs);
}
