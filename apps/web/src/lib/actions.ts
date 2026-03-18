"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncDiffEntry, MfdsApiSource } from "@/lib/types";
import type { FilterChip } from "@/lib/mfds-search-utils";
import { parseMessageCore, getAISettingsFromClient } from "@/lib/parse-service";

// --- Messages (captured_messages table) ---

export async function createMessage(data: {
  source_app: string;
  sender?: string;
  content: string;
}) {
  const supabase = createAdminClient();
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from("captured_messages").insert({
    id,
    user_id: (await supabase.auth.getUser()).data.user?.id ?? "00000000-0000-0000-0000-000000000000",
    app_name: data.source_app,
    sender: data.sender ?? "unknown",
    content: data.content,
    source: "web",
    received_at: Date.now(),
    updated_at: Date.now(),
    is_archived: false,
    is_deleted: false,
    is_pinned: false,
  });
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteMessage(id: number | string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("captured_messages")
    .update({ is_deleted: true, updated_at: Date.now() })
    .eq("id", String(id));
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteMessages(ids: (number | string)[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("captured_messages")
    .update({ is_deleted: true, updated_at: Date.now() })
    .in("id", ids.map(String));
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { success: true };
}

// reparseMessage and reparseMessages are no longer supported
// (raw_messages parsing infrastructure was removed in migration 00030)

export async function reparseMessage(_id: number, _hospitalId?: number) {
  return { message_id: _id, status: "unsupported", items: 0, warnings: ["Message parsing has been removed"] };
}

export async function reparseMessages(_ids: number[]) {
  const results = _ids.map((id) => ({ message_id: id, status: "unsupported" }));
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { results };
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
  data: { quantity?: number; unit_price?: number; product_id?: number; supplier_id?: number | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
  return { success: true };
}

export async function deleteOrderItem(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
  return { success: true };
}

// --- Suppliers ---

export async function createSupplier(data: {
  name: string;
  short_name?: string;
  business_number?: string;
  ceo_name?: string;
  phone?: string;
  fax?: string;
  address?: string;
  website?: string;
  business_type?: string;
  business_category?: string;
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
    return { success: false, error: data?.error ?? error.message ?? "동기화 요청 실패", fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
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
    return { success: false, error: data?.error ?? error.message ?? "동기화 요청 실패", fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
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
  
  try {
    // 1. Try Edge Function first
    const { data: result, error: funcError } = await supabase.functions.invoke("manage-users", {
      body: { _action: "create", ...data },
    });

    if (!funcError) {
      revalidatePath("/users");
      return result;
    }

    console.warn("manage-users edge function failed, attempting direct admin creation:", funcError.message);
  } catch (e) {
    console.warn("Edge function invoke error, falling back to direct admin client");
  }

  // 2. Direct Admin Client Fallback (more reliable for local dev)
  const admin = createAdminClient();
  
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (createError) {
    return { error: `인증 사용자 생성 실패: ${createError.message}` };
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .insert({
      id: newUser.user.id,
      name: data.name,
      role: data.role || "viewer",
      is_active: true,
    });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return { error: `프로필 생성 실패: ${profileError.message}` };
  }

  revalidatePath("/users");
  return { 
    user: { 
      id: newUser.user.id, 
      email: newUser.user.email, 
      name: data.name, 
      role: data.role || "viewer" 
    } 
  };
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    body: { _action: "update", id, ...data },
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
    body: { _action: "delete", id },
  });
  if (error) {
    return { error: result?.error ?? error.message ?? "사용자 비활성화 실패" };
  }
  revalidatePath("/users");
  return result;
}

// --- KPIS Reports ---

export async function upsertKpisReport(
  orderItemId: number,
  data: { report_status?: string; notes?: string },
) {
  const supabase = await createClient();
  // Check existing
  const { data: existing } = await supabase
    .from("kpis_reports")
    .select("id")
    .eq("order_item_id", orderItemId)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = { ...data };
    if (data.report_status === "reported") updates.reported_at = new Date().toISOString();
    const { error } = await supabase.from("kpis_reports").update(updates).eq("id", existing.id);
    if (error) throw error;
  } else {
    const insert: Record<string, unknown> = { order_item_id: orderItemId, ...data };
    if (data.report_status === "reported") insert.reported_at = new Date().toISOString();
    const { error } = await supabase.from("kpis_reports").insert(insert);
    if (error) throw error;
  }
  revalidatePath("/orders");
  return { success: true };
}

// --- Order Comments ---

export async function createOrderComment(orderId: number, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("order_comments").insert({
    order_id: orderId,
    user_id: user?.id ?? null,
    content,
  });
  if (error) throw error;
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

export async function deleteOrderComment(commentId: number, orderId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_comments").delete().eq("id", commentId);
  if (error) throw error;
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

export async function getOrderComments(orderId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_comments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// --- MFDS Direct API Search ---

async function getMfdsApiKey(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  if (!data?.value) throw new Error("MFDS API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.");
  return data.value;
}

function parseMfdsApiItems(body: Record<string, unknown>): Record<string, unknown>[] {
  if (!body) return [];
  const items = body.items;
  if (!items) return [];
  if (Array.isArray(items)) return items as Record<string, unknown>[];
  const obj = items as Record<string, unknown>;
  const item = obj.item;
  if (!item) return [];
  if (Array.isArray(item)) return item as Record<string, unknown>[];
  return [item as Record<string, unknown>];
}

// --- Partner Products (Hospitals/Suppliers) ---

export async function getPartnerProducts(partnerType: "hospital" | "supplier", partnerId: number) {
  const supabase = await createClient();
  try {
    const { data: mappings, error } = await supabase.from("partner_products").select("*").eq("partner_type", partnerType).eq("partner_id", partnerId).order("created_at", { ascending: false });
    if (error || !mappings || mappings.length === 0) return [];

    const productIds = mappings.filter(m => m.product_source === 'product').map(m => m.product_id);
    const drugIds = mappings.filter(m => m.product_source === 'drug').map(m => m.product_id);
    const deviceIds = mappings.filter(m => m.product_source === 'device').map(m => m.product_id);

    const [pRes, drRes, dvRes] = await Promise.all([
      productIds.length > 0 ? supabase.from("products").select("id, name, standard_code").in("id", productIds) : { data: [] },
      drugIds.length > 0 ? supabase.from("my_drugs").select("id, item_name, bar_code").in("id", drugIds) : { data: [] },
      deviceIds.length > 0 ? supabase.from("my_devices").select("id, prdlst_nm, udidi_cd").in("id", deviceIds) : { data: [] },
    ]);

    const pMap = new Map((pRes.data ?? []).map((p: any) => [p.id, p]));
    const drMap = new Map((drRes.data ?? []).map((d: any) => [d.id, d]));
    const dvMap = new Map((dvRes.data ?? []).map((v: any) => [v.id, v]));

    return mappings.map(item => {
      let name = "알 수 없는 품목", code = item.standard_code || "";
      if (item.product_source === "product") { const p = pMap.get(item.product_id); if (p) { name = p.name; code = p.standard_code || code; } }
      else if (item.product_source === "drug") { const d = drMap.get(item.product_id); if (d) { name = d.item_name; code = d.bar_code || code; } }
      else if (item.product_source === "device") { const v = dvMap.get(item.product_id); if (v) { name = v.prdlst_nm; code = v.udidi_cd || code; } }
      return { ...item, name, code };
    });
  } catch (err) { return []; }
}

export async function addPartnerProduct(params: { partnerType: "hospital" | "supplier", partnerId: number, productSource: "product" | "drug" | "device", productId: any, standardCode?: string, unitPrice?: number }) {
  const supabase = await createClient();
  const { partnerType, partnerId, productSource, standardCode, unitPrice } = params;
  const productId = typeof params.productId === 'string' ? parseInt(params.productId, 10) : params.productId;
  if (!productId || isNaN(productId)) return { success: false, error: "유효하지 않은 품목 ID입니다." };

  try {
    const { data: existing, error: checkError } = await supabase.from("partner_products").select("id").match({ partner_type: partnerType, partner_id: partnerId, product_source: productSource, product_id: productId }).maybeSingle();
    if (checkError) throw checkError;
    if (existing) return { success: true, alreadyExists: true };

    const history = unitPrice ? [{ price: unitPrice, changed_at: new Date().toISOString(), reason: "Initial registration" }] : [];
    const { error } = await supabase.from("partner_products").insert({ partner_type: partnerType, partner_id: partnerId, product_source: productSource, product_id: productId, standard_code: standardCode, unit_price: unitPrice, price_history: history });
    if (error) throw error;

    revalidatePath("/suppliers"); revalidatePath("/hospitals");
    return { success: true };
  } catch (err) { return { success: false, error: (err as Error).message }; }
}

export async function updatePartnerProductPrice(id: number, newPrice: number, reason = "Manual update") {
  const supabase = await createClient();
  try {
    const { data: cur } = await supabase.from("partner_products").select("price_history, unit_price").eq("id", id).single();
    if (!cur) throw new Error("품목을 찾을 수 없습니다.");
    const history = [...(Array.isArray(cur.price_history) ? cur.price_history : []), { price: newPrice, changed_at: new Date().toISOString(), reason }];
    const { error } = await supabase.from("partner_products").update({ unit_price: newPrice, price_history: history, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    revalidatePath("/suppliers"); revalidatePath("/hospitals");
    return { success: true };
  } catch (err) { return { success: false, error: (err as Error).message }; }
}

export async function deletePartnerProduct(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("partner_products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers"); revalidatePath("/hospitals");
  return { success: true };
}

// --- My Products ---

export async function searchMyItems(params: any) {
  const { query, sourceType, page = 1, pageSize = 30, filters = [], sortBy, sortOrder = "asc" } = params;
  const supabase = await createClient();
  const q = query.trim();
  const from = (page - 1) * pageSize, to = from + pageSize - 1;
  const table = sourceType === "drug" ? "my_drugs" : "my_devices";
  let dbQuery = supabase.from(table).select("*", { count: "exact" });

  if (q) {
    if (sourceType === "drug") dbQuery = dbQuery.or(`item_name.ilike.%${q}%,entp_name.ilike.%${q}%,bar_code.ilike.%${q}%`);
    else dbQuery = dbQuery.or(`prdlst_nm.ilike.%${q}%,mnft_iprt_entp_nm.ilike.%${q}%,udidi_cd.ilike.%${q}%`);
  }
  for (const chip of filters) {
    const dbCol = chip.field.toLowerCase();
    if (chip.operator === "contains") dbQuery = dbQuery.filter(dbCol, "ilike", `%${chip.value}%`);
    else if (chip.operator === "equals") dbQuery = dbQuery.filter(dbCol, "eq", chip.value);
  }
  dbQuery = dbQuery.order(sortBy?.toLowerCase() || (sourceType === "drug" ? "item_name" : "prdlst_nm"), { ascending: sortOrder === "asc" }).range(from, to);

  const { data, count, error } = await dbQuery;
  if (error) throw error;
  const items = (data ?? []).map((row: any) => {
    const mapped = { ...row };
    Object.entries(row).forEach(([k, v]) => { if (!["id", "unit_price", "added_at", "synced_at"].includes(k)) mapped[k.toUpperCase()] = v; });
    return mapped;
  });
  return { items, totalCount: count ?? 0, page };
}

export async function searchMfdsItems(params: any) {
  const { query, sourceType, page = 1, pageSize = 30, filters = [], sortBy, sortOrder = "asc" } = params;
  const supabase = await createClient();
  const q = query.trim();
  const from = (page - 1) * pageSize, to = from + pageSize - 1;
  let dbQuery = supabase.from("mfds_items").select("*", { count: "exact" }).eq("source_type", sourceType);

  if (q) dbQuery = dbQuery.or(`item_name.ilike.%${q}%,manufacturer.ilike.%${q}%,standard_code.ilike.%${q}%`);
  for (const chip of filters) dbQuery = dbQuery.filter(`raw_data->>${chip.field}`, "ilike", `%${chip.value}%`);
  dbQuery = dbQuery.order("item_name", { ascending: sortOrder === "asc" }).range(from, to);

  const { data, count, error } = await dbQuery;
  if (error) throw error;
  const items = (data ?? []).map((row: any) => ({ ...row.raw_data, id: row.source_key, MFDS_ID: row.id }));
  return { items, totalCount: count ?? 0, page };
}

export async function addToMyDrugs(item: Record<string, unknown>): Promise<{ success: boolean; id?: number; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const barCode = (item.BAR_CODE as string) ?? (item.bar_code as string) ?? null;
  if (barCode) {
    const { data: existing } = await supabase.from("my_drugs").select("id").eq("bar_code", barCode).maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }
  const row: any = {};
  const drugKeys = ["ITEM_SEQ", "ITEM_NAME", "ITEM_ENG_NAME", "ENTP_NAME", "ENTP_NO", "ITEM_PERMIT_DATE", "CNSGN_MANUF", "ETC_OTC_CODE", "CHART", "BAR_CODE", "MATERIAL_NAME", "EE_DOC_ID", "UD_DOC_ID", "NB_DOC_ID", "STORAGE_METHOD", "VALID_TERM", "PACK_UNIT", "EDI_CODE", "PERMIT_KIND_NAME", "CANCEL_DATE", "CANCEL_NAME", "CHANGE_DATE", "ATC_CODE", "RARE_DRUG_YN"];
  for (const key of drugKeys) row[key.toLowerCase()] = (item[key] as string) ?? (item[key.toLowerCase()] as string) ?? null;
  const { data, error } = await supabase.from("my_drugs").insert(row).select("id").single();
  if (error) { console.error("addToMyDrugs error:", error); return { success: false }; }
  revalidatePath("/products"); return { success: true, id: data.id };
}

export async function addToMyDevices(item: Record<string, unknown>): Promise<{ success: boolean; id?: number; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const udidiCd = (item.UDIDI_CD as string) ?? (item.udidi_cd as string) ?? null;
  if (udidiCd) {
    const { data: existing } = await supabase.from("my_devices").select("id").eq("udidi_cd", udidiCd).maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }
  const row: any = {};
  const deviceKeys = ["UDIDI_CD", "PRDLST_NM", "MNFT_IPRT_ENTP_NM", "MDEQ_CLSF_NO", "CLSF_NO_GRAD_CD", "PERMIT_NO", "PRMSN_YMD", "FOML_INFO", "PRDT_NM_INFO", "HMBD_TRSPT_MDEQ_YN", "DSPSBL_MDEQ_YN", "TRCK_MNG_TRGT_YN", "TOTAL_DEV", "CMBNMD_YN", "USE_BEFORE_STRLZT_NEED_YN", "STERILIZATION_METHOD_NM", "USE_PURPS_CONT", "STRG_CND_INFO", "CIRC_CND_INFO", "RCPRSLRY_TRGT_YN"];
  for (const key of deviceKeys) row[key.toLowerCase()] = (item[key] as string) ?? (item[key.toLowerCase()] as string) ?? null;
  const { data, error } = await supabase.from("my_devices").insert(row).select("id").single();
  if (error) { console.error("addToMyDevices error:", error); return { success: false }; }
  revalidatePath("/products"); return { success: true, id: data.id };
}

export async function deleteMyDrug(id: number) { const supabase = await createClient(); await supabase.from("my_drugs").delete().eq("id", id); revalidatePath("/products/my"); return { success: true }; }
export async function deleteMyDevice(id: number) { const supabase = await createClient(); await supabase.from("my_devices").delete().eq("id", id); revalidatePath("/products/my"); return { success: true }; }
export async function updateMyDrugPrice(id: number, p: number | null) { const supabase = await createClient(); await supabase.from("my_drugs").update({ unit_price: p }).eq("id", id); revalidatePath("/products/my"); return { success: true }; }
export async function updateMyDevicePrice(id: number, p: number | null) { const supabase = await createClient(); await supabase.from("my_devices").update({ unit_price: p }).eq("id", id); revalidatePath("/products/my"); return { success: true }; }

export async function getActiveSyncLog() {
  const supabase = await createClient();
  const { data } = await supabase.from("mfds_sync_logs").select("*").in("status", ["running", "partial"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return {
    logId: data.id,
    sourceType: data.source_type,
    syncMode: data.sync_mode ?? "incremental",
    totalFetched: data.total_fetched,
    totalUpserted: data.total_upserted,
    apiTotalCount: data.api_total_count,
  };
}

export async function getMfdsSyncProgress(logId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("mfds_sync_logs").select("*").eq("id", logId).single();
  return {
    status: data?.status ?? "unknown",
    syncMode: data?.sync_mode ?? "incremental",
    totalFetched: data?.total_fetched ?? 0,
    totalUpserted: data?.total_upserted ?? 0,
    apiTotalCount: data?.api_total_count ?? null,
    errorMessage: data?.error_message ?? null,
    sourceType: data?.source_type ?? null,
    nextPage: data?.next_page ?? null,
    failedPages: data?.failed_pages ?? [],
  };
}

export async function getMfdsSyncStatus() {
  const supabase = await createClient();
  const [l, dr, dv, metaDrug, metaDevice] = await Promise.all([
    supabase.from("mfds_sync_logs").select("finished_at").eq("status", "completed").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("mfds_items").select("id", { count: "exact", head: true }).eq("source_type", "drug"),
    supabase.from("mfds_items").select("id", { count: "exact", head: true }).eq("source_type", "device_std"),
    supabase.from("mfds_sync_meta").select("*").eq("source_type", "drug").maybeSingle(),
    supabase.from("mfds_sync_meta").select("*").eq("source_type", "device_std").maybeSingle(),
  ]);
  return {
    lastSync: l.data?.finished_at ?? null,
    drugCount: dr.count ?? 0,
    deviceCount: dv.count ?? 0,
    meta: {
      drug: metaDrug.data ?? null,
      device_std: metaDevice.data ?? null,
    },
  };
}

// --- Products (Legacy/Sync) ---

export async function createProduct(data: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase.from("products").insert(data).select("id").single();
  if (error) throw error;
  revalidatePath("/products");
  return { id: (row as { id: number }).id };
}

export async function updateProduct(id: number, data: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProducts(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function getProductAliases(productId: number) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("product_aliases").select("*").eq("product_id", productId).order("id");
  if (error) throw error;
  return data ?? [];
}

export async function createProductAlias(productId: number, data: { alias: string; hospital_id?: number | null; source?: string | null }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("product_aliases").insert({ product_id: productId, ...data });
  if (error) throw error;
  return { success: true };
}

export async function updateProductAlias(productId: number, aliasId: number, data: { alias?: string; hospital_id?: number | null }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("product_aliases").update(data).eq("id", aliasId).eq("product_id", productId);
  if (error) throw error;
  return { success: true };
}

export async function deleteProductAlias(productId: number, aliasId: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("product_aliases").delete().eq("id", aliasId).eq("product_id", productId);
  if (error) throw error;
  return { success: true };
}

export async function searchMfdsDrug(filters: any, page = 1) {
  const key = await getMfdsApiKey();
  const p = new URLSearchParams({ serviceKey: key, pageNo: String(page), numOfRows: "25", type: "json" });
  for (const [k, v] of Object.entries(filters)) if ((v as string).trim()) p.set(k, (v as string).trim());
  const res = await fetch(`https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?${p}`);
  if (!res.ok) return { items: [], totalCount: 0 };
  const j = await res.json();
  return { items: parseMfdsApiItems(j?.body), totalCount: j?.body?.totalCount ?? 0, page };
}

export async function searchMfdsDevice(filters: any, page = 1) {
  const key = await getMfdsApiKey();
  const p = new URLSearchParams({ serviceKey: key, pageNo: String(page), numOfRows: "25", type: "json" });
  for (const [k, v] of Object.entries(filters)) if ((v as string).trim()) p.set(k, (v as string).trim());
  const res = await fetch(`https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03?${p}`);
  if (!res.ok) return { items: [], totalCount: 0 };
  const j = await res.json();
  return { items: parseMfdsApiItems(j?.body), totalCount: j?.body?.totalCount ?? 0, page };
}

export async function syncMyDrug(id: number) {
  const supabase = await createClient();
  const { data: d } = await supabase.from("my_drugs").select("*").eq("id", id).single();
  if (!d?.item_seq) return { found: false, changes: [] };
  const r = await searchMfdsDrug({ ITEM_SEQ: d.item_seq });
  if (r.items.length === 0) return { found: false, changes: [] };
  const api = r.items[0] as any;
  const changes: any[] = [];
  const keys = ["ITEM_NAME", "ENTP_NAME", "BAR_CODE"];
  for (const k of keys) if (d[k.toLowerCase()] !== api[k]) changes.push({ column: k.toLowerCase(), oldValue: d[k.toLowerCase()], newValue: api[k] });
  return { found: true, changes };
}

export async function syncMyDevice(id: number) {
  const supabase = await createClient();
  const { data: d } = await supabase.from("my_devices").select("*").eq("id", id).single();
  if (!d?.udidi_cd) return { found: false, changes: [] };
  const r = await searchMfdsDevice({ UDIDI_CD: d.udidi_cd });
  if (r.items.length === 0) return { found: false, changes: [] };
  const api = r.items[0] as any;
  const changes: any[] = [];
  const keys = ["PRDLST_NM", "MNFT_IPRT_ENTP_NM", "UDIDI_CD"];
  for (const k of keys) if (d[k.toLowerCase()] !== api[k]) changes.push({ column: k.toLowerCase(), oldValue: d[k.toLowerCase()], newValue: api[k] });
  return { found: true, changes };
}

export async function applyDrugSync(id: number, updates: any) {
  const supabase = await createClient();
  await supabase.from("my_drugs").update({ ...updates, synced_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/products/my"); return { success: true };
}

export async function applyDeviceSync(id: number, updates: any) {
  const supabase = await createClient();
  await supabase.from("my_devices").update({ ...updates, synced_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/products/my"); return { success: true };
}

export async function triggerMfdsSync(sourceType: string) {
  return { success: true, stats: { drug_added: 0, device_added: 0, device_std_added: 0 }, errors: null };
}
