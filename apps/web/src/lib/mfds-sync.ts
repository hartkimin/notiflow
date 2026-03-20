/**
 * MFDS Sync Engine v3 — Simple, Robust, Docker-Native
 *
 * Strategy:
 * - Full mode: no date filter → fetch ALL items from API sequentially
 * - Incremental mode: date-window filter for daily updates
 * - Page-by-page: fetch 500 items → UPSERT to DB → next page
 * - No time budget (Docker, not serverless)
 * - Resume: saves next_page after each page → restart continues from there
 * - No duplicates: UPSERT on UNIQUE(source_type, source_key)
 * - Retry: 3 attempts per page with exponential backoff
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const SAFE_WINDOW_DAYS = 30;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;

// ─── Types ───────────────────────────────────────────────────────────

interface ApiConfig {
  url: string;
  sourceKeyField: string;
  itemNameField: string;
  manufacturerField: string;
  standardCodeField: string;
  permitDateField: string;
  startDateParam: string;
  endDateParam: string;
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
    sourceKeyField: "ITEM_SEQ",
    itemNameField: "ITEM_NAME",
    manufacturerField: "ENTP_NAME",
    standardCodeField: "BAR_CODE",
    permitDateField: "ITEM_PERMIT_DATE",
    startDateParam: "prmsn_dt_start",
    endDateParam: "prmsn_dt_end",
  },
  device_std: {
    url: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    sourceKeyField: "UDIDI_CD",
    itemNameField: "PRDLST_NM",
    manufacturerField: "MNFT_IPRT_ENTP_NM",
    standardCodeField: "UDIDI_CD",
    permitDateField: "PRMSN_YMD",
    startDateParam: "prmsn_ymd_start",
    endDateParam: "prmsn_ymd_end",
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
 * Sync items from MFDS API to mfds_items table.
 *
 * How it works:
 * 1. Fetch page N from API (500 items)
 * 2. UPSERT to DB (unique on source_type + source_key → no duplicates)
 * 3. Save progress (next_page = N+1) to sync log
 * 4. Repeat until last page
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
    const { data: latestRow } = await admin
      .from("mfds_items")
      .select("permit_date")
      .eq("source_type", sourceType)
      .not("permit_date", "is", null)
      .order("permit_date", { ascending: false })
      .limit(1)
      .single();

    if (latestRow?.permit_date) {
      // Go back SAFE_WINDOW_DAYS for safety (items may be added retroactively)
      const latest = latestRow.permit_date.replace(/\D/g, ""); // normalize to YYYYMMDD
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

      // Transform → deduplicate within page
      const seen = new Set<string>();
      const apiRows: { source_key: string; item_name: string; manufacturer: string; standard_code: string; permit_date: string; raw_data: any }[] = [];
      for (const item of items) {
        const key = String(item[config.sourceKeyField] || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        apiRows.push({
          source_key: key,
          item_name: String(item[config.itemNameField] || ""),
          manufacturer: String(item[config.manufacturerField] || ""),
          standard_code: String(item[config.standardCodeField] || ""),
          permit_date: String(item[config.permitDateField] || ""),
          raw_data: item,
        });
      }

      const now = new Date().toISOString();
      let toUpsert: any[];

      // Both modes upsert all fetched items (incremental already filtered by date at API level)
      // UPSERT on UNIQUE(source_type, source_key) handles duplicates safely
      toUpsert = apiRows.map(row => ({
        source_type: sourceType,
        source_key: row.source_key,
        item_name: row.item_name,
        manufacturer: row.manufacturer,
        standard_code: row.standard_code,
        permit_date: row.permit_date,
        raw_data: row.raw_data,
        synced_at: now,
      }));

      if (toUpsert.length > 0) {
        const { count, error } = await admin
          .from("mfds_items")
          .upsert(toUpsert, { onConflict: "source_type,source_key", count: "exact" });
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
      .from("mfds_items")
      .select("id", { count: "exact", head: true })
      .eq("source_type", sourceType);

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

export async function findPartialSync() {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("mfds_sync_logs")
    .select("id, source_type, next_page, total_fetched, total_upserted, sync_mode")
    .eq("status", "partial")
    .order("started_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}

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
    .from("mfds_items")
    .select("id", { count: "exact", head: true })
    .eq("source_type", sourceType);

  if (meta.api_total_count && localCount != null) {
    const ratio = localCount / meta.api_total_count;
    if (ratio < 0.9) {
      return { mode: "full", reason: `로컬 ${localCount} / API ${meta.api_total_count} (${(ratio * 100).toFixed(0)}%)` };
    }
  }

  return { mode: "incremental", reason: "정상" };
}
