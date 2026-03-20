/**
 * MFDS Sync Engine v3 — Simple, Robust, Docker-Native
 *
 * Strategy:
 * - Full mode: no date filter → fetch ALL items from API sequentially
 * - Incremental mode: date-window filter for daily updates
 * - Page-by-page: fetch 500 items → UPSERT to DB → next page
 * - No time budget (Docker, not serverless)
 * - Resume: saves next_page after each page → restart continues from there
 * - No duplicates: UPSERT on table-specific unique column (item_seq / udidi_cd)
 * - Retry: 3 attempts per page with exponential backoff
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const SAFE_WINDOW_DAYS = 30;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;

// ─── Types ───────────────────────────────────────────────────────────

interface FieldMapping {
  apiField: string;
  dbColumn: string;
}

interface ApiConfig {
  url: string;
  tableName: string;
  uniqueColumn: string;
  sourceKeyField: string;
  itemNameField: string;
  manufacturerField: string;
  permitDateField: string;
  startDateParam: string;
  endDateParam: string;
  fieldMappings: FieldMapping[];
}

export type SyncMode = "full" | "incremental";

export interface SyncProgress {
  totalFetched: number;
  totalUpserted: number;
  currentPage: number;
  totalPages: number | null;
  durationMs: number;
  syncMode: SyncMode;
}

export interface SyncResult {
  totalFetched: number;
  totalUpserted: number;
  outcome: "completed" | "partial" | "cancelled";
  nextPage: number | null;
  apiTotalCount: number | null;
}

// ─── API Configs ─────────────────────────────────────────────────────

export const MFDS_API_CONFIGS: Record<string, ApiConfig> = {
  drug: {
    url: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    tableName: "mfds_drugs",
    uniqueColumn: "item_seq",
    sourceKeyField: "ITEM_SEQ",
    itemNameField: "ITEM_NAME",
    manufacturerField: "ENTP_NAME",
    permitDateField: "ITEM_PERMIT_DATE",
    startDateParam: "prmsn_dt_start",
    endDateParam: "prmsn_dt_end",
    fieldMappings: [
      { apiField: "ITEM_SEQ", dbColumn: "item_seq" },
      { apiField: "ITEM_NAME", dbColumn: "item_name" },
      { apiField: "ITEM_ENG_NAME", dbColumn: "item_eng_name" },
      { apiField: "ENTP_NAME", dbColumn: "entp_name" },
      { apiField: "ENTP_ENG_NAME", dbColumn: "entp_eng_name" },
      { apiField: "ENTP_NO", dbColumn: "entp_no" },
      { apiField: "ITEM_PERMIT_DATE", dbColumn: "item_permit_date" },
      { apiField: "CNSGN_MANUF", dbColumn: "cnsgn_manuf" },
      { apiField: "ETC_OTC_CODE", dbColumn: "etc_otc_code" },
      { apiField: "CHART", dbColumn: "chart" },
      { apiField: "BAR_CODE", dbColumn: "bar_code" },
      { apiField: "MATERIAL_NAME", dbColumn: "material_name" },
      { apiField: "STORAGE_METHOD", dbColumn: "storage_method" },
      { apiField: "VALID_TERM", dbColumn: "valid_term" },
      { apiField: "PACK_UNIT", dbColumn: "pack_unit" },
      { apiField: "EDI_CODE", dbColumn: "edi_code" },
      { apiField: "ATC_CODE", dbColumn: "atc_code" },
      { apiField: "MAIN_ITEM_INGR", dbColumn: "main_item_ingr" },
      { apiField: "MAIN_INGR_ENG", dbColumn: "main_ingr_eng" },
      { apiField: "INGR_NAME", dbColumn: "ingr_name" },
      { apiField: "TOTAL_CONTENT", dbColumn: "total_content" },
      { apiField: "PERMIT_KIND_NAME", dbColumn: "permit_kind_name" },
      { apiField: "MAKE_MATERIAL_FLAG", dbColumn: "make_material_flag" },
      { apiField: "NEWDRUG_CLASS_NAME", dbColumn: "newdrug_class_name" },
      { apiField: "INDUTY_TYPE", dbColumn: "induty_type" },
      { apiField: "CANCEL_DATE", dbColumn: "cancel_date" },
      { apiField: "CANCEL_NAME", dbColumn: "cancel_name" },
      { apiField: "CHANGE_DATE", dbColumn: "change_date" },
      { apiField: "GBN_NAME", dbColumn: "gbn_name" },
      { apiField: "NARCOTIC_KIND_CODE", dbColumn: "narcotic_kind_code" },
      { apiField: "RARE_DRUG_YN", dbColumn: "rare_drug_yn" },
      { apiField: "REEXAM_DATE", dbColumn: "reexam_date" },
      { apiField: "REEXAM_TARGET", dbColumn: "reexam_target" },
      { apiField: "BIZRNO", dbColumn: "bizrno" },
      { apiField: "EE_DOC_ID", dbColumn: "ee_doc_id" },
      { apiField: "UD_DOC_ID", dbColumn: "ud_doc_id" },
      { apiField: "NB_DOC_ID", dbColumn: "nb_doc_id" },
      { apiField: "INSERT_FILE", dbColumn: "insert_file" },
    ],
  },
  device_std: {
    url: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    tableName: "mfds_devices",
    uniqueColumn: "udidi_cd",
    sourceKeyField: "UDIDI_CD",
    itemNameField: "PRDLST_NM",
    manufacturerField: "MNFT_IPRT_ENTP_NM",
    permitDateField: "PRMSN_YMD",
    startDateParam: "prmsn_ymd_start",
    endDateParam: "prmsn_ymd_end",
    fieldMappings: [
      { apiField: "UDIDI_CD", dbColumn: "udidi_cd" },
      { apiField: "PRDLST_NM", dbColumn: "prdlst_nm" },
      { apiField: "PRDT_NM_INFO", dbColumn: "prdt_nm_info" },
      { apiField: "MNFT_IPRT_ENTP_NM", dbColumn: "mnft_iprt_entp_nm" },
      { apiField: "PERMIT_NO", dbColumn: "permit_no" },
      { apiField: "PRMSN_YMD", dbColumn: "prmsn_ymd" },
      { apiField: "MDEQ_CLSF_NO", dbColumn: "mdeq_clsf_no" },
      { apiField: "CLSF_NO_GRAD_CD", dbColumn: "clsf_no_grad_cd" },
      { apiField: "FOML_INFO", dbColumn: "foml_info" },
      { apiField: "USE_PURPS_CONT", dbColumn: "use_purps_cont" },
      { apiField: "HMBD_TRSPT_MDEQ_YN", dbColumn: "hmbd_trspt_mdeq_yn" },
      { apiField: "DSPSBL_MDEQ_YN", dbColumn: "dspsbl_mdeq_yn" },
      { apiField: "TRCK_MNG_TRGT_YN", dbColumn: "trck_mng_trgt_yn" },
      { apiField: "RCPRSLRY_TRGT_YN", dbColumn: "rcprslry_trgt_yn" },
      { apiField: "TOTAL_DEV", dbColumn: "total_dev" },
      { apiField: "CMBNMD_YN", dbColumn: "cmbnmd_yn" },
      { apiField: "USE_BEFORE_STRLZT_NEED_YN", dbColumn: "use_before_strlzt_need_yn" },
      { apiField: "STERILIZATION_METHOD_NM", dbColumn: "sterilization_method_nm" },
      { apiField: "STRG_CND_INFO", dbColumn: "strg_cnd_info" },
      { apiField: "CIRC_CND_INFO", dbColumn: "circ_cnd_info" },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createAdminSupabase() {
  return createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Fetch One Page (with retry) ─────────────────────────────────────

async function fetchPage(
  config: ApiConfig,
  apiKey: string,
  page: number,
  startDate?: string,
  endDate?: string,
): Promise<{ items: any[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(page),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  });
  if (startDate && endDate) {
    params.set(config.startDateParam, startDate);
    params.set(config.endDateParam, endDate);
  }

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${config.url}?${params}`);
      if (!res.ok) throw new Error(`API ${res.status}`);

      const json = await res.json();
      const body = json?.body;
      if (!body) return { items: [], totalCount: 0 };

      let items = body.items;
      if (!items) items = [];
      if (!Array.isArray(items)) {
        items = items.item
          ? Array.isArray(items.item) ? items.item : [items.item]
          : [];
      }
      return { items, totalCount: body.totalCount || 0 };
    } catch (err) {
      lastErr = err as Error;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(`[Sync] Page ${page} attempt ${attempt} failed, retry in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastErr!;
}

// ─── Core Sync ───────────────────────────────────────────────────────

/**
 * Sync items from MFDS API to mfds_drugs or mfds_devices table.
 *
 * How it works:
 * 1. Fetch page N from API (500 items)
 * 2. Map API fields to DB columns via config.fieldMappings
 * 3. UPSERT to config.tableName (unique on config.uniqueColumn → no duplicates)
 * 4. Save progress (next_page = N+1) to sync log
 * 5. Repeat until last page
 *
 * On interruption: next call with same logId resumes from saved next_page.
 * On restart from scratch: next_page=1, re-fetches all (UPSERT = idempotent).
 */
export async function runSync(
  sourceType: string,
  apiKey: string,
  logId: number,
  syncMode: SyncMode = "full",
  startPage = 1,
  priorFetched = 0,
  priorUpserted = 0,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult> {
  const admin = createAdminSupabase();
  const config = MFDS_API_CONFIGS[sourceType];
  if (!config) throw new Error(`Unknown source: ${sourceType}`);

  // Full: fetch all pages, upsert all items
  // Incremental: use date filter from last known permit_date → fetch only new/recent items
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (syncMode === "incremental" && startPage <= 1) {
    // Find the latest permit_date in DB for this source type to use as start filter
    const permitDateColumn = config.permitDateField.toLowerCase();
    const { data: latestRow } = await admin
      .from(config.tableName)
      .select(permitDateColumn)
      .not(permitDateColumn, "is", null)
      .order(permitDateColumn, { ascending: false })
      .limit(1)
      .single();

    if (latestRow?.[permitDateColumn]) {
      // Go back SAFE_WINDOW_DAYS for safety (items may be added retroactively)
      const latest = (latestRow[permitDateColumn] as string).replace(/\D/g, ""); // normalize to YYYYMMDD
      const d = new Date(
        parseInt(latest.slice(0, 4)),
        parseInt(latest.slice(4, 6)) - 1,
        parseInt(latest.slice(6, 8)),
      );
      d.setDate(d.getDate() - SAFE_WINDOW_DAYS);
      startDate = formatDate(d);
      endDate = formatDate(new Date()); // today
      console.log(`[Sync] incremental date range: ${startDate} ~ ${endDate} (latest permit: ${latest}, window: ${SAFE_WINDOW_DAYS}d)`);
      // Record date range in sync log
      await admin.from("mfds_sync_logs").update({
        sync_start_date: startDate,
        sync_end_date: endDate,
      }).eq("id", logId);
    } else {
      console.log(`[Sync] No existing data found — falling back to full fetch`);
    }
  }

  // If resuming an incremental sync, restore saved date params from sync log
  if (syncMode === "incremental" && startPage > 1 && !startDate) {
    const { data: logData } = await admin
      .from("mfds_sync_logs")
      .select("sync_start_date, sync_end_date")
      .eq("id", logId)
      .single();
    if (logData?.sync_start_date && logData?.sync_end_date) {
      startDate = logData.sync_start_date;
      endDate = logData.sync_end_date;
      console.log(`[Sync] Restored date range from log: ${startDate} ~ ${endDate}`);
    }
  }

  console.log(`[Sync] ${syncMode} sync — key: ${config.sourceKeyField}${startDate ? ` (date filter: ${startDate}~${endDate})` : " (no date filter)"}`);

  // ── Main loop ──
  let totalFetched = priorFetched;
  let totalUpserted = priorUpserted;
  let page = startPage;
  let apiTotalCount: number | null = null;
  const t0 = Date.now();

  try {
    while (true) {
      // Check cancellation every page
      const { data: logStatus } = await admin
        .from("mfds_sync_logs")
        .select("status")
        .eq("id", logId)
        .single();
      if (logStatus?.status === "cancelled") {
        console.log("[Sync] Cancelled.");
        return { totalFetched, totalUpserted, outcome: "cancelled", nextPage: page, apiTotalCount };
      }

      // Fetch (with date filter for incremental, no filter for full)
      const { items, totalCount } = await fetchPage(config, apiKey, page, startDate, endDate);
      if (apiTotalCount == null && totalCount > 0) apiTotalCount = totalCount;
      if (items.length === 0) break;

      totalFetched += items.length;

      // Transform API items → DB rows using field mappings
      const now = new Date().toISOString();
      const seen = new Set<string>();
      const toUpsert: Record<string, unknown>[] = [];
      for (const item of items) {
        const key = String(item[config.sourceKeyField] || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const row: Record<string, unknown> = { synced_at: now };
        for (const { apiField, dbColumn } of config.fieldMappings) {
          const val = item[apiField];
          row[dbColumn] = val != null ? String(val) : null;
        }
        toUpsert.push(row);
      }

      if (toUpsert.length > 0) {
        const { count, error } = await admin
          .from(config.tableName)
          .upsert(toUpsert, { onConflict: config.uniqueColumn, count: "exact" });
        if (error) {
          console.error(`[Sync] Upsert error page ${page}:`, error.message);
        } else {
          totalUpserted += count || toUpsert.length;
        }
      }

      // Save progress
      const totalPages = apiTotalCount ? Math.ceil(apiTotalCount / PAGE_SIZE) : null;
      await admin.from("mfds_sync_logs").update({
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        next_page: page + 1,
        api_total_count: apiTotalCount,
        duration_ms: Date.now() - t0,
      }).eq("id", logId).eq("status", "running");

      onProgress?.({
        totalFetched,
        totalUpserted,
        currentPage: page,
        totalPages,
        durationMs: Date.now() - t0,
        syncMode,
      });

      const upsertInfo = toUpsert.length > 0 ? `${toUpsert.length} upsert` : "";
      console.log(`[Sync] Page ${page}/${totalPages ?? "?"} → ${upsertInfo} (fetched: ${totalFetched})`);

      // Done?
      if (totalPages != null && page >= totalPages) break;
      page++;
    }

    // ── Complete ──
    await admin.from("mfds_sync_logs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      total_fetched: totalFetched,
      total_upserted: totalUpserted,
      next_page: null,
      api_total_count: apiTotalCount,
      duration_ms: Date.now() - t0,
    }).eq("id", logId);

    // Update meta
    const { count: localCount } = await admin
      .from(config.tableName)
      .select("id", { count: "exact", head: true });

    await admin.from("mfds_sync_meta").upsert({
      source_type: sourceType,
      api_total_count: apiTotalCount,
      local_count: localCount ?? 0,
      updated_at: new Date().toISOString(),
      ...(syncMode === "full"
        ? { last_full_sync_at: new Date().toISOString() }
        : { last_incremental_at: new Date().toISOString() }),
    }, { onConflict: "source_type" });

    console.log(`[Sync] Done! ${totalFetched} fetched, ${totalUpserted} upserted in ${Date.now() - t0}ms`);
    return { totalFetched, totalUpserted, outcome: "completed", nextPage: null, apiTotalCount };
  } catch (err) {
    console.error("[Sync] Fatal:", err);
    // Save as partial (resumable) if we made any progress, otherwise error
    const hasProgress = totalFetched > priorFetched;
    await admin.from("mfds_sync_logs").update({
      status: hasProgress ? "partial" : "error",
      finished_at: new Date().toISOString(),
      error_message: (err as Error).message,
      total_fetched: totalFetched,
      total_upserted: totalUpserted,
      next_page: page,
      duration_ms: Date.now() - t0,
    }).eq("id", logId);
    if (hasProgress) {
      console.log(`[Sync] Saved as partial at page ${page} (${totalFetched} fetched) — resumable`);
      return { totalFetched, totalUpserted, outcome: "partial" as const, nextPage: page, apiTotalCount };
    }
    throw err;
  }
}

// ─── Helpers for routes ──────────────────────────────────────────────

export async function createSyncLog(triggerType: string, sourceType: string, syncMode: SyncMode = "full") {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("mfds_sync_logs")
    .insert({
      trigger_type: triggerType,
      source_type: sourceType,
      status: "running",
      sync_mode: syncMode,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getMfdsApiKeyFromDb() {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  return data?.value || "";
}

export async function cleanupStaleLogs() {
  const admin = createAdminSupabase();
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30분
  await admin
    .from("mfds_sync_logs")
    .update({
      status: "error",
      error_message: "동기화 시간 초과 (비정상 종료)",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", staleThreshold);
}

export async function findResumableSync() {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("mfds_sync_logs")
    .select("id, source_type, next_page, total_fetched, total_upserted, sync_mode")
    .in("status", ["partial", "error", "cancelled"])
    .not("next_page", "is", null)
    .order("started_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}

// Backward-compatible alias
export const findPartialSync = findResumableSync;

export async function detectSyncMode(
  sourceType: string,
  apiKey: string,
): Promise<{ mode: SyncMode; reason: string }> {
  const admin = createAdminSupabase();
  const config = MFDS_API_CONFIGS[sourceType];
  if (!config) return { mode: "incremental", reason: "unknown source" };

  const { data: meta } = await admin
    .from("mfds_sync_meta")
    .select("*")
    .eq("source_type", sourceType)
    .maybeSingle();

  if (!meta?.last_full_sync_at) {
    return { mode: "full", reason: "전체 동기화 이력 없음" };
  }

  const { count: localCount } = await admin
    .from(config?.tableName ?? "mfds_drugs")
    .select("id", { count: "exact", head: true });

  if (meta.api_total_count && localCount != null) {
    const ratio = localCount / meta.api_total_count;
    if (ratio < 0.9) {
      return { mode: "full", reason: `로컬 ${localCount} / API ${meta.api_total_count} (${(ratio * 100).toFixed(0)}%)` };
    }
  }

  return { mode: "incremental", reason: "정상" };
}
