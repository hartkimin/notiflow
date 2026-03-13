"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncDiffEntry, MfdsApiSource } from "@/lib/types";
import type { FilterChip } from "@/lib/mfds-search-utils";
import { parseMessageCore, getAISettingsFromClient } from "@/lib/parse-service";

// --- Messages (raw_messages table) ---

export async function createMessage(data: {
  source_app: string;
  sender?: string;
  content: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("raw_messages").insert({
    source_app: data.source_app,
    sender: data.sender ?? null,
    content: data.content,
    received_at: new Date().toISOString(),
    parse_status: "pending",
  });
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteMessage(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("raw_messages").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteMessages(ids: number[]) {
  if (ids.length === 0) return { success: true };
  const supabase = createAdminClient();
  const { error } = await supabase.from("raw_messages").delete().in("id", ids);
  if (error) throw error;
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { success: true };
}

export async function reparseMessage(id: number, hospitalId?: number) {
  const admin = createAdminClient();
  const { data: msg } = await admin
    .from("raw_messages")
    .select("content")
    .eq("id", id)
    .single();
  if (!msg) throw new Error("Message not found");
  const settings = await getAISettingsFromClient(admin);
  const result = await parseMessageCore(admin, settings, id, msg.content, hospitalId ?? null, false);
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return result;
}

export async function reparseMessages(ids: number[]) {
  if (ids.length === 0) return { results: [] };
  const admin = createAdminClient();
  const settings = await getAISettingsFromClient(admin);
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data: msg } = await admin
        .from("raw_messages")
        .select("content, hospital_id")
        .eq("id", id)
        .single();
      if (!msg) return { message_id: id, status: "not_found" };
      return parseMessageCore(admin, settings, id, msg.content, (msg.hospital_id as number | null) ?? null, false);
    }),
  );
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
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    body: { _action: "create", ...data },
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
  } = params;

  const supabase = await createClient();
  const q = query.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build base query
  let dbQuery = supabase
    .from("mfds_items")
    .select("*", { count: "exact" })
    .eq("source_type", sourceType);

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

  // Extract raw_data from each row (this is what the UI expects)
  const items = (data ?? []).map(
    (row: { raw_data: Record<string, unknown> }) => row.raw_data,
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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

export async function getMfdsSyncStatus(): Promise<{
  lastSync: string | null;
  drugCount: number;
  deviceCount: number;
}> {
  const supabase = await createClient();

  const [lastSyncResult, drugCountResult, deviceCountResult] =
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
    ]);

  return {
    lastSync: lastSyncResult.data?.finished_at ?? null,
    drugCount: drugCountResult.count ?? 0,
    deviceCount: deviceCountResult.count ?? 0,
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

// --- My Drugs / My Devices ---

export async function addToMyDrugs(item: Record<string, unknown>) {
  const supabase = await createClient();
  const barCode = (item.BAR_CODE as string) ?? null;

  if (barCode) {
    const { data: existing } = await supabase
      .from("my_drugs")
      .select("id")
      .eq("bar_code", barCode)
      .maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }

  const row: Record<string, unknown> = {};
  const drugKeys = [
    "ITEM_SEQ", "ITEM_NAME", "ITEM_ENG_NAME", "ENTP_NAME", "ENTP_NO",
    "ITEM_PERMIT_DATE", "CNSGN_MANUF", "ETC_OTC_CODE", "CHART", "BAR_CODE",
    "MATERIAL_NAME", "EE_DOC_ID", "UD_DOC_ID", "NB_DOC_ID", "STORAGE_METHOD",
    "VALID_TERM", "PACK_UNIT", "EDI_CODE", "PERMIT_KIND_NAME", "CANCEL_DATE",
    "CANCEL_NAME", "CHANGE_DATE", "ATC_CODE", "RARE_DRUG_YN",
  ];
  for (const key of drugKeys) {
    row[key.toLowerCase()] = (item[key] as string) ?? null;
  }

  const { data, error } = await supabase
    .from("my_drugs")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/products");
  return { success: true, id: data.id, alreadyExists: false };
}

export async function addToMyDevices(item: Record<string, unknown>) {
  const supabase = await createClient();
  const udidiCd = (item.UDIDI_CD as string) ?? null;

  if (udidiCd) {
    const { data: existing } = await supabase
      .from("my_devices")
      .select("id")
      .eq("udidi_cd", udidiCd)
      .maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }

  const row: Record<string, unknown> = {};
  const deviceKeys = [
    "UDIDI_CD", "PRDLST_NM", "MNFT_IPRT_ENTP_NM", "MDEQ_CLSF_NO",
    "CLSF_NO_GRAD_CD", "PERMIT_NO", "PRMSN_YMD", "FOML_INFO", "PRDT_NM_INFO",
    "HMBD_TRSPT_MDEQ_YN", "DSPSBL_MDEQ_YN", "TRCK_MNG_TRGT_YN", "TOTAL_DEV",
    "CMBNMD_YN", "USE_BEFORE_STRLZT_NEED_YN", "STERILIZATION_METHOD_NM",
    "USE_PURPS_CONT", "STRG_CND_INFO", "CIRC_CND_INFO", "RCPRSLRY_TRGT_YN",
  ];
  for (const key of deviceKeys) {
    row[key.toLowerCase()] = (item[key] as string) ?? null;
  }

  const { data, error } = await supabase
    .from("my_devices")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/products");
  return { success: true, id: data.id, alreadyExists: false };
}

export async function deleteMyDrug(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("my_drugs").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function deleteMyDevice(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("my_devices").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

// --- Price update ---

export async function updateMyDrugPrice(id: number, unitPrice: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_drugs")
    .update({ unit_price: unitPrice })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function updateMyDevicePrice(id: number, unitPrice: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_devices")
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
  const supabase = await createClient();

  const { data: drug, error } = await supabase
    .from("my_drugs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  if (!drug.item_seq) return { found: false, changes: [] as SyncDiffEntry[] };

  const apiResult = await searchMfdsDrug({ ITEM_SEQ: drug.item_seq ?? "" });
  if (apiResult.items.length === 0) {
    return { found: false, changes: [] as SyncDiffEntry[] };
  }

  const apiItem = apiResult.items[0] as Record<string, unknown>;
  const changes: SyncDiffEntry[] = [];

  for (const apiKey of DRUG_API_KEYS) {
    const dbKey = apiKey.toLowerCase();
    const oldVal = (drug[dbKey] as string) ?? "";
    const newVal = ((apiItem[apiKey] as string) ?? "");
    if (oldVal !== newVal) {
      changes.push({
        column: dbKey,
        label: DRUG_LABELS[dbKey] ?? dbKey,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  await supabase.from("my_drugs").update({ synced_at: new Date().toISOString() }).eq("id", id);

  return { found: true, changes };
}

export async function syncMyDevice(id: number) {
  const supabase = await createClient();

  const { data: device, error } = await supabase
    .from("my_devices")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  if (!device.udidi_cd) return { found: false, changes: [] as SyncDiffEntry[] };

  const apiResult = await searchMfdsDevice({ UDIDI_CD: device.udidi_cd ?? "" });
  if (apiResult.items.length === 0) {
    return { found: false, changes: [] as SyncDiffEntry[] };
  }

  const apiItem = apiResult.items[0] as Record<string, unknown>;
  const changes: SyncDiffEntry[] = [];

  for (const apiKey of DEVICE_API_KEYS) {
    const dbKey = apiKey.toLowerCase();
    const oldVal = (device[dbKey] as string) ?? "";
    const newVal = ((apiItem[apiKey] as string) ?? "");
    if (oldVal !== newVal) {
      changes.push({
        column: dbKey,
        label: DEVICE_LABELS[dbKey] ?? dbKey,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  await supabase.from("my_devices").update({ synced_at: new Date().toISOString() }).eq("id", id);

  return { found: true, changes };
}

export async function applyDrugSync(id: number, updates: Record<string, string>) {
  const supabase = await createClient();
  const allowed = new Set(DRUG_API_KEYS.map(k => k.toLowerCase()));
  const filtered: Record<string, string> = {};
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.has(key)) filtered[key] = val;
  }
  const { error } = await supabase
    .from("my_drugs")
    .update({ ...filtered, synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function applyDeviceSync(id: number, updates: Record<string, string>) {
  const supabase = await createClient();
  const allowed = new Set(DEVICE_API_KEYS.map(k => k.toLowerCase()));
  const filtered: Record<string, string> = {};
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.has(key)) filtered[key] = val;
  }
  const { error } = await supabase
    .from("my_devices")
    .update({ ...filtered, synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

// --- Products (legacy product catalog) ---

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
  const { data, error } = await supabase
    .from("product_aliases")
    .select("*")
    .eq("product_id", productId)
    .order("id");
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

// --- MFDS Sync (legacy) ---

export async function triggerMfdsSync(sourceType: string) {
  void sourceType;
  return {
    success: true,
    stats: { drug_added: 0, device_added: 0, device_std_added: 0 } as Record<string, number>,
    errors: null as string[] | null,
  };
}
