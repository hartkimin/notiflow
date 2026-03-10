"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncDiffEntry, MfdsApiSource } from "@/lib/types";
import type { FilterChip } from "@/lib/mfds-search-utils";

// --- Messages (captured_messages soft delete) ---

export async function deleteMessage(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("captured_messages")
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteMessages(ids: string[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("captured_messages")
    .update({ is_deleted: true })
    .in("id", ids);
  if (error) throw error;
  revalidatePath("/notifications");
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
  const supabase = createAdminClient();
  const { error } = await supabase.from("hospitals").insert(data);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function updateHospital(id: number, data: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("hospitals").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function deleteHospital(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("hospitals").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function deleteHospitals(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { error } = await supabase.from("hospitals").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

// --- Orders ---

export async function deleteOrder(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateOrder(id: number, data: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteOrders(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
  const { error } = await supabase.from("order_items").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/orders");
  return { success: true };
}

export async function deleteOrderItem(id: number) {
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
  const { error } = await supabase.from("suppliers").insert(data);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function updateSupplier(id: number, data: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("suppliers").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function deleteSuppliers(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { error } = await supabase.from("suppliers").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

// --- Supplier Items (junction: supplier_items) ---

export async function addSupplierItems(supplierId: number, mfdsItemIds: number[]) {
  if (mfdsItemIds.length === 0) return { success: true };
  const supabase = createAdminClient();
  const rows = mfdsItemIds.map((mfdsItemId) => ({
    supplier_id: supplierId,
    mfds_item_id: mfdsItemId,
  }));
  const { error } = await supabase
    .from("supplier_items")
    .upsert(rows, { onConflict: "supplier_id,mfds_item_id" });
  if (error) throw error;
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  return { success: true };
}

export async function updateSupplierItem(
  id: number,
  data: { purchase_price?: number | null; is_primary?: boolean },
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("supplier_items")
    .update(data)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function removeSupplierItem(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("supplier_items").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function searchFavoriteItems(query: string): Promise<
  Array<{
    id: number;
    source_type: string;
    item_name: string;
    manufacturer: string | null;
    standard_code: string | null;
  }>
> {
  const supabase = createAdminClient();
  const q = `%${query}%`;

  const { data, error } = await supabase
    .from("mfds_items")
    .select("id, source_type, item_name, manufacturer, standard_code")
    .eq("is_favorite", true)
    .or(`item_name.ilike.${q},manufacturer.ilike.${q},standard_code.ilike.${q}`)
    .limit(50);

  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id as number,
    source_type: (d.source_type as string) ?? "",
    item_name: (d.item_name as string) ?? "",
    manufacturer: d.manufacturer as string | null,
    standard_code: d.standard_code as string | null,
  }));
}

// --- Mobile Devices ---

export async function updateDevice(id: string, data: Record<string, unknown>) {
  const admin = createAdminClient();
  const { error } = await admin.from("mobile_devices").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/devices");
  return { success: true };
}

export async function requestDeviceSync(id: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("mobile_devices")
    .update({ sync_requested_at: now })
    .eq("id", id);
  if (error) {
    return { success: false, error: error.message, fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  revalidatePath("/devices");
  revalidatePath("/dashboard");
  return { success: true, fcm_sent: 0, fcm_failed: 0, realtime_updated: 1 };
}

export async function requestAllDevicesSync() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: devices, error: queryError } = await admin
    .from("mobile_devices")
    .select("id")
    .eq("is_active", true);
  if (queryError) {
    return { success: false, error: queryError.message, fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  const ids = (devices ?? []).map((d) => d.id);
  if (ids.length === 0) {
    return { success: true, fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  const { error } = await admin
    .from("mobile_devices")
    .update({ sync_requested_at: now })
    .in("id", ids);
  if (error) {
    return { success: false, error: error.message, fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  revalidatePath("/devices");
  revalidatePath("/dashboard");
  return { success: true, fcm_sent: 0, fcm_failed: 0, realtime_updated: ids.length };
}

// --- Users (via manage-users Edge Function) ---

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const admin = createAdminClient();
  const { email, password, name, role = "viewer" } = data;

  const validRoles = ["admin", "manager", "viewer"];
  if (!validRoles.includes(role)) {
    return { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` };
  }

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return { error: `사용자 생성 실패: ${createError.message}` };
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .insert({ id: newUser.user.id, name, role, is_active: true });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return { error: `프로필 생성 실패: ${profileError.message}` };
  }

  revalidatePath("/users");
  return {
    user: {
      id: newUser.user.id,
      email: newUser.user.email,
      name,
      role,
      is_active: true,
    },
  };
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const admin = createAdminClient();

  const profileUpdate: Record<string, unknown> = {};
  if (data.name !== undefined) profileUpdate.name = data.name;
  if (data.role !== undefined) profileUpdate.role = data.role;
  if (data.is_active !== undefined) profileUpdate.is_active = data.is_active;

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin
      .from("user_profiles")
      .upsert({ id, ...profileUpdate }, { onConflict: "id" });
    if (error) return { error: `사용자 수정 실패: ${error.message}` };
  }

  if (data.password) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: data.password as string,
    });
    if (error) return { error: `비밀번호 변경 실패: ${error.message}` };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function deleteUser(id: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("user_profiles")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: `사용자 비활성화 실패: ${error.message}` };

  revalidatePath("/users");
  return { success: true, id };
}

// --- KPIS Reports ---

export async function upsertKpisReport(
  orderItemId: number,
  data: { report_status?: string; notes?: string },
) {
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
  const { error } = await supabase.from("order_comments").delete().eq("id", commentId);
  if (error) throw error;
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

export async function getOrderComments(orderId: number) {
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
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

// --- MFDS DB Search (replaces direct API search for browse mode) ---

export async function searchMfdsItems(params: {
  query: string;
  sourceType: MfdsApiSource;
  searchField?: string;
  page?: number;
  pageSize?: number;
  filters?: FilterChip[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  favoritesOnly?: boolean;
}): Promise<{
  items: Record<string, unknown>[];
  totalCount: number;
  page: number;
}> {
  const {
    query,
    sourceType,
    searchField = "_all",
    page = 1,
    pageSize = 25,
    filters = [],
    sortBy,
    sortOrder = "asc",
    favoritesOnly = false,
  } = params;

  const supabase = createAdminClient();
  const q = query.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build base query
  let dbQuery = supabase
    .from("mfds_items")
    .select("*", { count: "exact" })
    .eq("source_type", sourceType);

  if (favoritesOnly) {
    dbQuery = dbQuery.eq("is_favorite", true);
  }

  // Apply text search
  if (q) {
    if (searchField === "_all") {
      dbQuery = dbQuery.or(
        `item_name.ilike.%${q}%,manufacturer.ilike.%${q}%,standard_code.ilike.%${q}%`,
      );
    } else {
      const fieldMap: Record<string, string> = {
        ITEM_NAME: "item_name",
        ENTP_NAME: "manufacturer",
        BAR_CODE: "standard_code",
        ITEM_SEQ: "source_key",
        PRDLST_NM: "item_name",
        MNFT_IPRT_ENTP_NM: "manufacturer",
        UDIDI_CD: "standard_code",
      };

      const dbCol = fieldMap[searchField];
      if (dbCol) {
        dbQuery = dbQuery.ilike(dbCol, `%${q}%`);
      } else {
        dbQuery = dbQuery.filter(
          `raw_data->>${searchField}`,
          "ilike",
          `%${q}%`,
        );
      }
    }
  }

  // Apply filter chips (JSONB field-level filters)
  for (const chip of filters) {
    const fieldPath = `raw_data->>${chip.field}`;
    switch (chip.operator) {
      case "contains":
        dbQuery = dbQuery.filter(fieldPath, "ilike", `%${chip.value}%`);
        break;
      case "equals":
        dbQuery = dbQuery.filter(fieldPath, "eq", chip.value);
        break;
      case "startsWith":
        dbQuery = dbQuery.filter(fieldPath, "ilike", `${chip.value}%`);
        break;
      case "notContains":
        // Supabase doesn't support NOT on filter directly, use raw
        dbQuery = dbQuery.not(
          `raw_data->>${chip.field}` as "id",
          "ilike",
          `%${chip.value}%`,
        );
        break;
      case "before":
        dbQuery = dbQuery.filter(fieldPath, "lt", chip.value);
        break;
      case "after":
        dbQuery = dbQuery.filter(fieldPath, "gt", chip.value);
        break;
      case "between":
        dbQuery = dbQuery.filter(fieldPath, "gte", chip.value);
        if (chip.valueTo) {
          dbQuery = dbQuery.filter(fieldPath, "lte", chip.valueTo);
        }
        break;
    }
  }

  // Sorting
  if (sortBy) {
    const fieldMap: Record<string, string> = {
      ITEM_NAME: "item_name",
      ENTP_NAME: "manufacturer",
      PRDLST_NM: "item_name",
      MNFT_IPRT_ENTP_NM: "manufacturer",
    };
    const dbCol = fieldMap[sortBy] ?? "item_name";
    dbQuery = dbQuery.order(dbCol, { ascending: sortOrder === "asc" });
  } else {
    dbQuery = dbQuery.order("item_name", { ascending: true });
  }

  // Pagination
  dbQuery = dbQuery.range(from, to);

  const { data, count, error } = await dbQuery;

  if (error) throw new Error(`DB 검색 오류: ${error.message}`);

  // Merge raw_data with row metadata (id, synced_at, unit_price, is_favorite)
  const items = (data ?? []).map(
    (row: { id: number; raw_data: Record<string, unknown>; synced_at: string; unit_price: number | null; is_favorite: boolean }) => ({
      ...(row.raw_data as Record<string, unknown>),
      id: row.id,
      synced_at: row.synced_at,
      unit_price: row.unit_price,
      is_favorite: row.is_favorite,
    }),
  );

  return {
    items,
    totalCount: count ?? 0,
    page,
  };
}

// ---------------------------------------------------------------------------
// MFDS Sync — triggers background API route, polls for status
// ---------------------------------------------------------------------------

export async function getMfdsSyncProgress(logId: number): Promise<{
  status: string;
  totalFetched: number;
  totalUpserted: number;
  errorMessage: string | null;
  sourceType: string | null;
  nextPage: number | null;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mfds_sync_logs")
    .select("status, total_fetched, total_upserted, error_message, source_type, next_page")
    .eq("id", logId)
    .single();

  return {
    status: data?.status ?? "unknown",
    totalFetched: data?.total_fetched ?? 0,
    totalUpserted: data?.total_upserted ?? 0,
    errorMessage: data?.error_message ?? null,
    sourceType: data?.source_type ?? null,
    nextPage: data?.next_page ?? null,
  };
}

/** Check if there is a currently running or partial sync */
export async function getActiveSyncLog(): Promise<{
  logId: number;
  sourceType: string;
  totalFetched: number;
  totalUpserted: number;
} | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mfds_sync_logs")
    .select("id, source_type, total_fetched, total_upserted")
    .in("status", ["running", "partial"])
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return {
    logId: data.id,
    sourceType: data.source_type,
    totalFetched: data.total_fetched,
    totalUpserted: data.total_upserted,
  };
}

/**
 * Find a resumable sync log for the given source type.
 * - "partial" logs → resume from next_page
 * - Stale "running" logs (started > 5 min ago) → calculate next_page, mark as partial
 * - Stale "running" with 0 progress → mark as error and skip
 */
const SYNC_PAGE_SIZE = 500; // Must match mfds-sync.ts PAGE_SIZE
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function getResumableSyncLog(sourceType: string): Promise<{
  logId: number;
  nextPage: number;
  totalFetched: number;
  totalUpserted: number;
} | null> {
  const admin = createAdminClient();

  // 1. Check for partial sync (has next_page set)
  const { data: partial } = await admin
    .from("mfds_sync_logs")
    .select("id, next_page, total_fetched, total_upserted")
    .eq("source_type", sourceType)
    .eq("status", "partial")
    .not("next_page", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (partial) {
    return {
      logId: partial.id,
      nextPage: partial.next_page,
      totalFetched: partial.total_fetched,
      totalUpserted: partial.total_upserted,
    };
  }

  // 2. Check for stale "running" sync (started > 5 min ago, server likely dead)
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  const { data: stale } = await admin
    .from("mfds_sync_logs")
    .select("id, total_fetched, total_upserted, started_at, duration_ms")
    .eq("source_type", sourceType)
    .eq("status", "running")
    .lt("started_at", staleThreshold)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (stale && stale.total_fetched > 0) {
    // Calculate next page from total_fetched (UPSERT is idempotent, so overlap is safe)
    const nextPage = Math.floor(stale.total_fetched / SYNC_PAGE_SIZE) + 1;

    // Mark as partial so it can be resumed
    await admin
      .from("mfds_sync_logs")
      .update({ status: "partial", next_page: nextPage })
      .eq("id", stale.id);

    return {
      logId: stale.id,
      nextPage,
      totalFetched: stale.total_fetched,
      totalUpserted: stale.total_upserted,
    };
  }

  // 3. Clean up stale running logs with no progress
  if (stale && stale.total_fetched === 0) {
    await admin
      .from("mfds_sync_logs")
      .update({
        status: "error",
        error_message: "동기화 프로세스 중단 (진행 없음)",
        finished_at: new Date().toISOString(),
      })
      .eq("id", stale.id);
  }

  return null;
}

export async function getMfdsSyncStatus(): Promise<{
  lastSync: string | null;
  drugCount: number;
  deviceCount: number;
  lastDrugSync: string | null;
  lastDeviceSync: string | null;
  favDrugCount: number;
  favDeviceCount: number;
  drugApiTotal: number;
  deviceApiTotal: number;
}> {
  const supabase = createAdminClient();

  const [lastSyncResult, drugCountResult, deviceCountResult, lastDrugSyncResult, lastDeviceSyncResult, favDrugResult, favDeviceResult, checkpointResult] =
    await Promise.all([
      supabase
        .from("mfds_sync_logs")
        .select("finished_at")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("mfds_items")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "drug"),
      supabase
        .from("mfds_items")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "device_std"),
      supabase
        .from("mfds_sync_logs")
        .select("finished_at")
        .eq("status", "completed")
        .eq("source_type", "drug")
        .order("finished_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("mfds_sync_logs")
        .select("finished_at")
        .eq("status", "completed")
        .eq("source_type", "device_std")
        .order("finished_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("mfds_items")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "drug")
        .eq("is_favorite", true),
      supabase
        .from("mfds_items")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "device_std")
        .eq("is_favorite", true),
      supabase
        .from("mfds_sync_checkpoints")
        .select("source_type, api_total")
        .in("source_type", ["drug", "device_std"]),
    ]);

  const checkpointMap: Record<string, number> = {};
  for (const row of checkpointResult.data ?? []) {
    checkpointMap[row.source_type] = row.api_total;
  }

  return {
    lastSync: lastSyncResult.data?.finished_at ?? null,
    drugCount: drugCountResult.count ?? 0,
    deviceCount: deviceCountResult.count ?? 0,
    lastDrugSync: lastDrugSyncResult.data?.finished_at ?? null,
    lastDeviceSync: lastDeviceSyncResult.data?.finished_at ?? null,
    favDrugCount: favDrugResult.count ?? 0,
    favDeviceCount: favDeviceResult.count ?? 0,
    drugApiTotal: checkpointMap["drug"] ?? 0,
    deviceApiTotal: checkpointMap["device_std"] ?? 0,
  };
}

// --- MFDS Direct API Search (kept for manage mode sync) ---

export async function searchMfdsDrug(
  filters: Record<string, string>,
  page = 1,
) {
  const serviceKey = await getMfdsApiKey();
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(page),
    numOfRows: "25",
    type: "json",
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }

  const url = `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MFDS API 오류: ${res.status}`);

  const json = await res.json();
  const body = json?.body;

  return {
    items: parseMfdsApiItems(body),
    totalCount: (body?.totalCount as number) ?? 0,
    page,
  };
}

export async function searchMfdsDevice(
  filters: Record<string, string>,
  page = 1,
) {
  const serviceKey = await getMfdsApiKey();
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(page),
    numOfRows: "25",
    type: "json",
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }

  const url = `https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MFDS API 오류: ${res.status}`);

  const json = await res.json();
  const body = json?.body;

  return {
    items: parseMfdsApiItems(body),
    totalCount: (body?.totalCount as number) ?? 0,
    page,
  };
}

// --- Favorites (mfds_items.is_favorite) ---

export async function addToMyDrugs(item: Record<string, unknown>) {
  const supabase = createAdminClient();
  const itemId = item.id as number | undefined;
  const itemSeq = (item.ITEM_SEQ as string) ?? null;
  const barCode = (item.BAR_CODE as string) ?? null;

  // Find the existing mfds_items row
  let query = supabase.from("mfds_items").select("id, is_favorite").eq("source_type", "drug");
  if (itemId) {
    query = query.eq("id", itemId);
  } else if (itemSeq) {
    query = query.eq("source_key", itemSeq);
  } else if (barCode) {
    query = query.eq("standard_code", barCode);
  } else {
    throw new Error("품목 식별 정보가 없습니다.");
  }

  const { data: existing } = await query.maybeSingle();
  if (!existing) throw new Error("검색 데이터베이스에서 해당 품목을 찾을 수 없습니다.");
  if (existing.is_favorite) return { success: true, id: existing.id, alreadyExists: true };

  const { error } = await supabase
    .from("mfds_items")
    .update({ is_favorite: true, favorited_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) throw error;

  revalidatePath("/products");
  revalidatePath("/products/my");
  return { success: true, id: existing.id, alreadyExists: false };
}

export async function addToMyDevices(item: Record<string, unknown>) {
  const supabase = createAdminClient();
  const itemId = item.id as number | undefined;
  const udidiCd = (item.UDIDI_CD as string) ?? null;

  let query = supabase.from("mfds_items").select("id, is_favorite").eq("source_type", "device_std");
  if (itemId) {
    query = query.eq("id", itemId);
  } else if (udidiCd) {
    query = query.or(`source_key.eq.${udidiCd},standard_code.eq.${udidiCd}`);
  } else {
    throw new Error("품목 식별 정보가 없습니다.");
  }

  const { data: existing } = await query.maybeSingle();
  if (!existing) throw new Error("검색 데이터베이스에서 해당 품목을 찾을 수 없습니다.");
  if (existing.is_favorite) return { success: true, id: existing.id, alreadyExists: true };

  const { error } = await supabase
    .from("mfds_items")
    .update({ is_favorite: true, favorited_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) throw error;

  revalidatePath("/products");
  revalidatePath("/products/my");
  return { success: true, id: existing.id, alreadyExists: false };
}

export async function deleteMyDrug(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("mfds_items")
    .update({ is_favorite: false, favorited_at: null, unit_price: null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  revalidatePath("/products");
  return { success: true };
}

export async function deleteMyDevice(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("mfds_items")
    .update({ is_favorite: false, favorited_at: null, unit_price: null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  revalidatePath("/products");
  return { success: true };
}

// --- Price update ---

export async function updateMyDrugPrice(id: number, unitPrice: number | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("mfds_items")
    .update({ unit_price: unitPrice })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function updateMyDevicePrice(id: number, unitPrice: number | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("mfds_items")
    .update({ unit_price: unitPrice })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

// --- Sync ---

const DRUG_API_KEYS = [
  "ITEM_SEQ", "ITEM_NAME", "ITEM_ENG_NAME", "ENTP_NAME", "ENTP_NO",
  "ITEM_PERMIT_DATE", "CNSGN_MANUF", "ETC_OTC_CODE", "CHART", "BAR_CODE",
  "MATERIAL_NAME", "EE_DOC_ID", "UD_DOC_ID", "NB_DOC_ID", "STORAGE_METHOD",
  "VALID_TERM", "PACK_UNIT", "EDI_CODE", "PERMIT_KIND_NAME", "CANCEL_DATE",
  "CANCEL_NAME", "CHANGE_DATE", "ATC_CODE", "RARE_DRUG_YN",
];

const DEVICE_API_KEYS = [
  "UDIDI_CD", "PRDLST_NM", "MNFT_IPRT_ENTP_NM", "MDEQ_CLSF_NO",
  "CLSF_NO_GRAD_CD", "PERMIT_NO", "PRMSN_YMD", "FOML_INFO", "PRDT_NM_INFO",
  "HMBD_TRSPT_MDEQ_YN", "DSPSBL_MDEQ_YN", "TRCK_MNG_TRGT_YN", "TOTAL_DEV",
  "CMBNMD_YN", "USE_BEFORE_STRLZT_NEED_YN", "STERILIZATION_METHOD_NM",
  "USE_PURPS_CONT", "STRG_CND_INFO", "CIRC_CND_INFO", "RCPRSLRY_TRGT_YN",
];

const DRUG_LABELS: Record<string, string> = {
  item_seq: "품목기준코드", item_name: "품목명", item_eng_name: "영문명",
  entp_name: "업체명", entp_no: "업체허가번호", item_permit_date: "허가일자",
  cnsgn_manuf: "위탁제조업체", etc_otc_code: "전문/일반", chart: "성상",
  bar_code: "표준코드", material_name: "성분", ee_doc_id: "효능효과",
  ud_doc_id: "용법용량", nb_doc_id: "주의사항", storage_method: "저장방법",
  valid_term: "유효기간", pack_unit: "포장단위", edi_code: "보험코드",
  permit_kind_name: "허가구분", cancel_date: "취소일자", cancel_name: "상태",
  change_date: "변경일자", atc_code: "ATC코드", rare_drug_yn: "희귀의약품",
};

const DEVICE_LABELS: Record<string, string> = {
  udidi_cd: "UDI-DI코드", prdlst_nm: "품목명", mnft_iprt_entp_nm: "제조수입업체명",
  mdeq_clsf_no: "분류번호", clsf_no_grad_cd: "등급", permit_no: "품목허가번호",
  prmsn_ymd: "허가일자", foml_info: "모델명", prdt_nm_info: "제품명",
  hmbd_trspt_mdeq_yn: "인체이식형여부", dspsbl_mdeq_yn: "일회용여부",
  trck_mng_trgt_yn: "추적관리대상", total_dev: "한벌구성여부",
  cmbnmd_yn: "조합의료기기", use_before_strlzt_need_yn: "사전멸균필요",
  sterilization_method_nm: "멸균방법", use_purps_cont: "사용목적",
  strg_cnd_info: "저장조건", circ_cnd_info: "유통취급조건",
  rcprslry_trgt_yn: "요양급여대상",
};

export async function syncMyDrug(id: number) {
  const supabase = createAdminClient();

  const { data: item, error } = await supabase
    .from("mfds_items")
    .select("source_key, raw_data")
    .eq("id", id)
    .single();
  if (error) throw error;

  const rawData = item.raw_data as Record<string, unknown>;
  const itemSeq = item.source_key ?? "";
  if (!itemSeq) return { found: false, changes: [] as SyncDiffEntry[] };

  // 품목기준코드(item_seq)로 식약처 API 검색
  const apiResult = await searchMfdsDrug({ item_seq: itemSeq });
  if (apiResult.items.length === 0) {
    return { found: false, changes: [] as SyncDiffEntry[] };
  }

  const apiItem = apiResult.items[0] as Record<string, unknown>;
  const changes: SyncDiffEntry[] = [];

  for (const apiKey of DRUG_API_KEYS) {
    const oldVal = (rawData[apiKey] as string) ?? "";
    const newVal = (apiItem[apiKey] as string) ?? "";
    if (oldVal !== newVal) {
      changes.push({
        column: apiKey,
        label: DRUG_LABELS[apiKey.toLowerCase()] ?? apiKey,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  await supabase.from("mfds_items")
    .update({ synced_at: new Date().toISOString() })
    .eq("id", id);

  return { found: true, changes };
}

export async function syncMyDevice(id: number) {
  const supabase = createAdminClient();

  const { data: item, error } = await supabase
    .from("mfds_items")
    .select("source_key, raw_data")
    .eq("id", id)
    .single();
  if (error) throw error;

  const rawData = item.raw_data as Record<string, unknown>;
  const udidiCd = item.source_key ?? "";
  if (!udidiCd) return { found: false, changes: [] as SyncDiffEntry[] };

  // UDI-DI코드로 식약처 API 검색
  const apiResult = await searchMfdsDevice({ UDIDI_CD: udidiCd });
  if (apiResult.items.length === 0) {
    return { found: false, changes: [] as SyncDiffEntry[] };
  }

  const apiItem = apiResult.items[0] as Record<string, unknown>;
  const changes: SyncDiffEntry[] = [];

  for (const apiKey of DEVICE_API_KEYS) {
    const oldVal = (rawData[apiKey] as string) ?? "";
    const newVal = (apiItem[apiKey] as string) ?? "";
    if (oldVal !== newVal) {
      changes.push({
        column: apiKey,
        label: DEVICE_LABELS[apiKey.toLowerCase()] ?? apiKey,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  await supabase.from("mfds_items")
    .update({ synced_at: new Date().toISOString() })
    .eq("id", id);

  return { found: true, changes };
}

export async function applyDrugSync(id: number, updates: Record<string, string>) {
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("mfds_items")
    .select("raw_data, item_name, manufacturer, standard_code")
    .eq("id", id)
    .single();
  if (!item) throw new Error("Item not found");

  const rawData = { ...(item.raw_data as Record<string, unknown>) };
  const allowed = new Set(DRUG_API_KEYS);
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.has(key)) rawData[key] = val;
  }

  const updatePayload: Record<string, unknown> = {
    raw_data: rawData,
    synced_at: new Date().toISOString(),
  };
  if (rawData.ITEM_NAME) updatePayload.item_name = rawData.ITEM_NAME;
  if (rawData.ENTP_NAME) updatePayload.manufacturer = rawData.ENTP_NAME;
  if (rawData.BAR_CODE) updatePayload.standard_code = rawData.BAR_CODE;

  const { error } = await supabase.from("mfds_items").update(updatePayload).eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function applyDeviceSync(id: number, updates: Record<string, string>) {
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("mfds_items")
    .select("raw_data, item_name, manufacturer, standard_code")
    .eq("id", id)
    .single();
  if (!item) throw new Error("Item not found");

  const rawData = { ...(item.raw_data as Record<string, unknown>) };
  const allowed = new Set(DEVICE_API_KEYS);
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.has(key)) rawData[key] = val;
  }

  const updatePayload: Record<string, unknown> = {
    raw_data: rawData,
    synced_at: new Date().toISOString(),
  };
  if (rawData.PRDLST_NM) updatePayload.item_name = rawData.PRDLST_NM;
  if (rawData.MNFT_IPRT_ENTP_NM) updatePayload.manufacturer = rawData.MNFT_IPRT_ENTP_NM;
  if (rawData.UDIDI_CD) updatePayload.standard_code = rawData.UDIDI_CD;

  const { error } = await supabase.from("mfds_items").update(updatePayload).eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}
