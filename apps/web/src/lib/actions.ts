"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProductAlias } from "@/lib/types";
import { getAISettings } from "@/lib/ai-client";
import { parseMessageCore, getHospitalAliases, aiParse, resolveHospitalFromSender } from "@/lib/parse-service";
import { matchProductsBulk, type ProductCatalogEntry } from "@/lib/parser";

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
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateOrder(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteOrders(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateOrderItem(
  id: number,
  data: { quantity?: number; unit_price?: number; product_id?: number },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
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
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMessage(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMessage(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Test parse (AI 테스트 — no DB writes, just parse + match)
// ---------------------------------------------------------------------------

export async function testParseMessage(content: string, hospitalId?: number, sender?: string) {
  const supabase = await createClient();
  const settings = await getAISettings();

  let resolvedHospitalId = hospitalId ?? null;
  let hospitalName: string | null = null;
  let aliases: { alias: string; product_name: string }[] = [];

  // Auto-resolve hospital from sender if no hospitalId
  if (!resolvedHospitalId && sender) {
    const resolved = await resolveHospitalFromSender(supabase, sender);
    if (resolved) {
      resolvedHospitalId = resolved.id;
      console.log(`[testParse] Auto-matched sender "${sender}" → hospital "${resolved.name}" (id=${resolved.id})`);
    }
  }

  if (resolvedHospitalId) {
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", resolvedHospitalId)
      .single();
    hospitalName = hospital?.name ?? null;
    aliases = await getHospitalAliases(supabase, resolvedHospitalId);
  }

  const { data: productRows } = await supabase
    .from("products")
    .select("official_name, short_name")
    .eq("is_active", true);

  const products: ProductCatalogEntry[] = (productRows ?? []).map(
    (p: { official_name: string; short_name: string | null }) => ({
      official_name: p.official_name,
      short_name: p.short_name,
    }),
  );

  const parseResult = await aiParse(content, settings, hospitalName, aliases, products);

  const matchedItems = parseResult.items.length > 0
    ? await matchProductsBulk(supabase, parseResult.items, resolvedHospitalId)
    : [];

  // Build match_summary counts
  let matched = 0, review = 0, unmatched = 0;
  for (const m of matchedItems) {
    if (m.match.match_status === "matched") matched++;
    else if (m.match.match_status === "review") review++;
    else unmatched++;
  }

  return {
    method: parseResult.method,
    ai_provider: parseResult.ai_provider ?? null,
    ai_model: parseResult.ai_model ?? null,
    latency_ms: parseResult.latency_ms,
    token_usage: parseResult.token_usage ?? null,
    warnings: parseResult.warnings,
    match_summary: { matched, review, unmatched },
    items: matchedItems.map((m) => ({
      original_text: m.parsed.item,
      product_official_name: m.match.product_name,
      quantity: m.parsed.qty,
      unit: m.parsed.unit,
      product_id: m.match.product_id,
      match_confidence: m.match.confidence,
      match_status: m.match.match_status,
      match_method: m.match.method,
    })),
  };
}

// ---------------------------------------------------------------------------
// Parse-message (delegates to parse-service.ts)
// ---------------------------------------------------------------------------

export async function reparseMessage(id: number, hospitalId?: number) {
  const supabase = await createClient();
  const settings = await getAISettings();

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
    .select("id, content, hospital_id, sender")
    .eq("id", id)
    .single();
  if (fetchErr || !msg) throw fetchErr ?? new Error("메시지를 찾을 수 없습니다.");

  // Auto-resolve hospital from sender if still no hospital_id
  let effectiveHospitalId = msg.hospital_id;
  if (!effectiveHospitalId && msg.sender) {
    const resolved = await resolveHospitalFromSender(supabase, msg.sender);
    if (resolved) {
      effectiveHospitalId = resolved.id;
      // Persist the resolved hospital_id on the message
      await supabase
        .from("raw_messages")
        .update({ hospital_id: resolved.id })
        .eq("id", id);
      console.log(`[reparseMessage] Auto-matched sender "${msg.sender}" → hospital "${resolved.name}" (id=${resolved.id})`);
    }
  }

  const result = await parseMessageCore(supabase, settings, msg.id, msg.content, effectiveHospitalId, true);
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return result;
}

export async function reparseMessages(ids: number[], hospitalId?: number) {
  if (ids.length === 0) return { success: true, results: [] };
  const supabase = await createClient();
  const settings = await getAISettings();

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
      const data = await parseMessageCore(supabase, settings, msg.id, msg.content, msg.hospital_id, true);
      results.push({ id: msg.id, data, error: null });
    } catch (err) {
      results.push({ id: msg.id, data: null, error: (err as Error).message });
    }
  }
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true, results };
}

export async function deleteMessages(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").delete().in("id", ids);
  if (error) throw error;
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
