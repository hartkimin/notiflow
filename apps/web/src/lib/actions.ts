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

// --- Users (direct admin client — no Edge Function dependency) ---

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const admin = createAdminClient();
  const role = data.role || "viewer";

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { name: data.name, role },
  });

  if (createError) {
    return { error: `인증 사용자 생성 실패: ${createError.message}` };
  }

  // Upsert: trigger may have already created a default profile row
  const { error: profileError } = await admin
    .from("user_profiles")
    .upsert({
      id: newUser.user.id,
      name: data.name,
      role,
      is_active: true,
    }, { onConflict: "id" });

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
      role,
    },
  };
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const admin = createAdminClient();
  const { name, role, is_active, password } = data as {
    name?: string; role?: string; is_active?: boolean; password?: string;
  };

  // Last admin protection
  if (role !== undefined || is_active === false) {
    const { data: current } = await admin.from("user_profiles").select("role").eq("id", id).single();
    if (current?.role === "admin") {
      const changingRole = role !== undefined && role !== "admin";
      if (changingRole || is_active === false) {
        const { count } = await admin.from("user_profiles").select("*", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
        if ((count || 0) <= 1) {
          return { error: "마지막 관리자는 변경할 수 없습니다." };
        }
      }
    }
  }

  // Update user_profiles
  const profileUpdate: Record<string, unknown> = {};
  if (name !== undefined) profileUpdate.name = name;
  if (role !== undefined) profileUpdate.role = role;
  if (is_active !== undefined) profileUpdate.is_active = is_active;

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from("user_profiles").update(profileUpdate).eq("id", id);
    if (error) return { error: `프로필 수정 실패: ${error.message}` };
  }

  // Sync to auth: password and/or user_metadata
  const authUpdate: Record<string, unknown> = {};
  if (password) authUpdate.password = password;
  if (name !== undefined || role !== undefined) {
    const { data: { user } } = await admin.auth.admin.getUserById(id);
    authUpdate.user_metadata = {
      ...(user?.user_metadata ?? {}),
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
    };
  }
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (error) return { error: `인증 사용자 수정 실패: ${error.message}` };
  }

  // Return updated profile
  const { data: updated } = await admin.from("user_profiles").select("*").eq("id", id).single();
  const { data: { user: authUser } } = await admin.auth.admin.getUserById(id);

  revalidatePath("/users");
  return {
    user: {
      id,
      email: authUser?.email ?? null,
      name: updated?.name ?? null,
      role: updated?.role ?? "viewer",
      is_active: updated?.is_active ?? true,
      created_at: authUser?.created_at ?? null,
      updated_at: updated?.updated_at ?? null,
    },
  };
}

export async function deleteUser(id: string) {
  const admin = createAdminClient();

  // Last admin protection
  const { data: target } = await admin.from("user_profiles").select("role").eq("id", id).single();
  if (target?.role === "admin") {
    const { count } = await admin.from("user_profiles").select("*", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
    if ((count || 0) <= 1) {
      return { error: "마지막 관리자는 변경할 수 없습니다." };
    }
  }

  // Soft delete
  const { error } = await admin.from("user_profiles").update({ is_active: false }).eq("id", id);
  if (error) return { error: `사용자 비활성화 실패: ${error.message}` };

  revalidatePath("/users");
  return { success: true, id };
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

    const ppIds = mappings.map(m => m.id);
    const [pRes, drRes, dvRes, aliasRes] = await Promise.all([
      productIds.length > 0 ? supabase.from("products").select("id, name, standard_code").in("id", productIds) : { data: [] },
      drugIds.length > 0 ? supabase.from("my_drugs").select("id, item_name, bar_code").in("id", drugIds) : { data: [] },
      deviceIds.length > 0 ? supabase.from("my_devices").select("id, prdlst_nm, udidi_cd").in("id", deviceIds) : { data: [] },
      supabase.from("partner_product_aliases").select("id, partner_product_id, alias").in("partner_product_id", ppIds),
    ]);

    const pMap = new Map((pRes.data ?? []).map((p: any) => [p.id, p]));
    const drMap = new Map((drRes.data ?? []).map((d: any) => [d.id, d]));
    const dvMap = new Map((dvRes.data ?? []).map((v: any) => [v.id, v]));

    // Build alias map: partner_product_id → [{id, alias}]
    const aliasMap = new Map<number, { id: number; alias: string }[]>();
    for (const a of aliasRes.data ?? []) {
      const list = aliasMap.get(a.partner_product_id) ?? [];
      list.push({ id: a.id, alias: a.alias });
      aliasMap.set(a.partner_product_id, list);
    }

    return mappings.map(item => {
      let name = "알 수 없는 품목", code = item.standard_code || "";
      if (item.product_source === "product") { const p = pMap.get(item.product_id); if (p) { name = p.name; code = p.standard_code || code; } }
      else if (item.product_source === "drug") { const d = drMap.get(item.product_id); if (d) { name = d.item_name; code = d.bar_code || code; } }
      else if (item.product_source === "device") { const v = dvMap.get(item.product_id); if (v) { name = v.prdlst_nm; code = v.udidi_cd || code; } }
      return { ...item, name, code, aliases: aliasMap.get(item.id) ?? [] };
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

// --- Partner Product Aliases ---

/** Client-side normalization matching the DB normalize_alias() function */
function normalizeAlias(input: string): string {
  return input.toLowerCase().replace(/[\s\p{P}]/gu, "");
}

export async function addPartnerProductAlias(partnerProductId: number, alias: string) {
  const trimmed = alias.trim();
  if (!trimmed) return { success: false, error: "별칭을 입력해주세요" };
  if (trimmed.length > 50) return { success: false, error: "별칭은 50자 이내로 입력해주세요" };

  const normalized = normalizeAlias(trimmed);
  if (!normalized) return { success: false, error: "유효한 문자를 포함한 별칭을 입력해주세요" };

  const supabase = await createClient();

  try {
    // Get partner info for this partner_product
    const { data: pp } = await supabase
      .from("partner_products")
      .select("id, partner_type, partner_id")
      .eq("id", partnerProductId)
      .single();
    if (!pp) return { success: false, error: "품목을 찾을 수 없습니다" };

    // Check alias count
    const { count } = await supabase
      .from("partner_product_aliases")
      .select("id", { count: "exact", head: true })
      .eq("partner_product_id", partnerProductId);
    if ((count ?? 0) >= 5) return { success: false, error: "별칭은 최대 5개까지 등록할 수 있습니다" };

    // Check same-item duplicate
    const { data: sameDup } = await supabase
      .from("partner_product_aliases")
      .select("id")
      .eq("partner_product_id", partnerProductId)
      .eq("alias_normalized", normalized)
      .maybeSingle();
    if (sameDup) return { success: false, error: "이미 등록된 별칭입니다" };

    // Check same-partner different-item duplicate
    const { data: partnerDup } = await supabase
      .from("partner_product_aliases")
      .select("partner_product_id")
      .eq("alias_normalized", normalized)
      .neq("partner_product_id", partnerProductId);

    if (partnerDup && partnerDup.length > 0) {
      // Check if any of these belong to the same partner
      const dupPpIds = partnerDup.map(d => d.partner_product_id);
      const { data: samePartnerPps } = await supabase
        .from("partner_products")
        .select("id, standard_code")
        .eq("partner_type", pp.partner_type)
        .eq("partner_id", pp.partner_id)
        .in("id", dupPpIds);

      if (samePartnerPps && samePartnerPps.length > 0) {
        const conflictCode = samePartnerPps[0].standard_code || "코드없음";
        return {
          success: false,
          error: `'${trimmed}'은(는) 다른 품목(${conflictCode})에 이미 사용 중입니다`,
        };
      }
    }

    // Insert
    const { data, error } = await supabase
      .from("partner_product_aliases")
      .insert({
        partner_product_id: partnerProductId,
        alias: trimmed,
        alias_normalized: normalized,
      })
      .select("id, alias, alias_normalized")
      .single();

    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === "23505") return { success: false, error: "이미 등록된 별칭입니다" };
      throw error;
    }
    revalidatePath("/suppliers");
    revalidatePath("/hospitals");
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deletePartnerProductAlias(aliasId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_product_aliases")
    .delete()
    .eq("id", aliasId);
  if (error) throw error;
  revalidatePath("/suppliers");
  revalidatePath("/hospitals");
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

  const tableName = sourceType === "drug" ? "mfds_drugs" : "mfds_devices";
  const nameCol = sourceType === "drug" ? "item_name" : "prdlst_nm";
  const mfrCol = sourceType === "drug" ? "entp_name" : "mnft_iprt_entp_nm";
  const codeCol = sourceType === "drug" ? "bar_code" : "udidi_cd";

  let dbQuery = supabase.from(tableName).select("*", { count: "exact" });

  if (q) dbQuery = dbQuery.or(`${nameCol}.ilike.%${q}%,${mfrCol}.ilike.%${q}%,${codeCol}.ilike.%${q}%`);
  for (const chip of filters) dbQuery = dbQuery.filter(chip.field.toLowerCase(), "ilike", `%${chip.value}%`);
  dbQuery = dbQuery.order(nameCol, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, count, error } = await dbQuery;
  if (error) throw error;
  const items = (data ?? []).map((row: any) => ({ ...row, _type: sourceType }));
  return { items, totalCount: count ?? 0, page };
}

export async function addToMyDrugs(item: Record<string, unknown>): Promise<{ success: boolean; id?: number; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const barCode = (item.bar_code as string) ?? null;
  if (barCode) {
    const { data: existing } = await supabase.from("my_drugs").select("id").eq("bar_code", barCode).maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }
  const row: any = {};
  const cols = [
    "item_seq", "item_name", "item_eng_name", "entp_name", "entp_no",
    "item_permit_date", "cnsgn_manuf", "etc_otc_code", "chart", "bar_code",
    "material_name", "ee_doc_id", "ud_doc_id", "nb_doc_id", "storage_method",
    "valid_term", "pack_unit", "edi_code", "permit_kind_name", "cancel_date",
    "cancel_name", "change_date", "atc_code", "rare_drug_yn",
  ];
  for (const col of cols) row[col] = (item[col] as string) ?? null;
  const { data, error } = await supabase.from("my_drugs").insert(row).select("id").single();
  if (error) { console.error("addToMyDrugs error:", error); return { success: false }; }
  revalidatePath("/products"); return { success: true, id: data.id };
}

export async function addToMyDevices(item: Record<string, unknown>): Promise<{ success: boolean; id?: number; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const udidiCd = (item.udidi_cd as string) ?? null;
  if (udidiCd) {
    const { data: existing } = await supabase.from("my_devices").select("id").eq("udidi_cd", udidiCd).maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }
  const row: any = {};
  const cols = [
    "udidi_cd", "prdlst_nm", "mnft_iprt_entp_nm", "mdeq_clsf_no", "clsf_no_grad_cd",
    "permit_no", "prmsn_ymd", "foml_info", "prdt_nm_info", "hmbd_trspt_mdeq_yn",
    "dspsbl_mdeq_yn", "trck_mng_trgt_yn", "total_dev", "cmbnmd_yn",
    "use_before_strlzt_need_yn", "sterilization_method_nm", "use_purps_cont",
    "strg_cnd_info", "circ_cnd_info", "rcprslry_trgt_yn",
  ];
  for (const col of cols) row[col] = (item[col] as string) ?? null;
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
  const [l, metaDrug, metaDevice, drugCount, deviceCount, logDrug, logDevice] = await Promise.all([
    supabase.from("mfds_sync_logs").select("finished_at").eq("status", "completed").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("mfds_sync_meta").select("*").eq("source_type", "drug").maybeSingle(),
    supabase.from("mfds_sync_meta").select("*").eq("source_type", "device_std").maybeSingle(),
    supabase.from("mfds_drugs").select("id", { count: "exact", head: true }),
    supabase.from("mfds_devices").select("id", { count: "exact", head: true }),
    supabase.from("mfds_sync_logs").select("api_total_count").eq("source_type", "drug").not("api_total_count", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("mfds_sync_logs").select("api_total_count").eq("source_type", "device_std").not("api_total_count", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    lastSync: l.data?.finished_at ?? null,
    drugCount: drugCount.count ?? 0,
    drugApiCount: metaDrug.data?.api_total_count ?? logDrug.data?.api_total_count ?? null,
    deviceCount: deviceCount.count ?? 0,
    deviceApiCount: metaDevice.data?.api_total_count ?? logDevice.data?.api_total_count ?? null,
    meta: { drug: metaDrug.data ?? null, device_std: metaDevice.data ?? null },
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

export async function triggerMfdsSync(sourceFilter: string) {
  const sources = sourceFilter === "all" ? ["drug", "device_std"] : [sourceFilter];
  const results: Record<string, any> = {};
  const errors: string[] = [];

  for (const sourceType of sources) {
    const baseUrl = typeof window === "undefined"
      ? `http://localhost:${process.env.PORT || 3000}`
      : "";
    const res = await fetch(`${baseUrl}/api/sync-mfds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType, syncMode: "full" }),
    });
    const data = await res.json();
    if (!res.ok) {
      errors.push(`${sourceType}: ${data.error}`);
    } else {
      results[sourceType] = data;
    }
  }

  if (errors.length > 0) {
    return { success: false, stats: { drug_added: 0, device_added: 0, device_std_added: 0 }, errors };
  }
  return { success: true, stats: results, errors: null };
}
