/**
 * Shared MFDS sync logic — used by both manual sync (/api/sync-mfds)
 * and scheduled cron sync (/api/cron/mfds-sync).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 500;
const OVERLAP_PAGES = 5;

interface ApiConfig {
  url: string;
  sourceKeyField: string;
  itemNameField: string;
  manufacturerField: string;
  standardCodeField: string;
  permitDateField: string;
}

export const MFDS_API_CONFIGS: Record<string, ApiConfig> = {
  drug: {
    url: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    sourceKeyField: "ITEM_SEQ",
    itemNameField: "ITEM_NAME",
    manufacturerField: "ENTP_NAME",
    standardCodeField: "BAR_CODE",
    permitDateField: "ITEM_PERMIT_DATE",
  },
  device_std: {
    url: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    sourceKeyField: "UDIDI_CD",
    itemNameField: "PRDLST_NM",
    manufacturerField: "MNFT_IPRT_ENTP_NM",
    standardCodeField: "UDIDI_CD",
    permitDateField: "PRMSN_YMD",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseItems(body: Record<string, unknown>): Record<string, unknown>[] {
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

async function fetchPage(
  config: ApiConfig,
  apiKey: string,
  page: number,
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(page),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  });

  const res = await fetch(`${config.url}?${params}`);
  if (!res.ok) throw new Error(`MFDS API ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const body = json?.body;

  return {
    items: parseItems(body),
    totalCount: (body?.totalCount as number) ?? 0,
  };
}

/** Lightweight call: fetch only totalCount without downloading items */
async function fetchApiTotalCount(
  config: ApiConfig,
  apiKey: string,
): Promise<number> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: "1",
    numOfRows: "1",
    type: "json",
  });
  const res = await fetch(`${config.url}?${params}`);
  if (!res.ok) throw new Error(`MFDS API ${res.status}`);
  const json = await res.json();
  return (json?.body?.totalCount as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Admin Supabase client (service_role, no cookies)
// ---------------------------------------------------------------------------

export function createAdminSupabase() {
  return createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---------------------------------------------------------------------------
// Calculate start page for incremental sync
// ---------------------------------------------------------------------------

export interface StartPageResult {
  startPage: number;
  apiTotal: number;
  dbCount: number;
  syncMode: "incremental" | "resume" | "full" | "skip";
}

export async function calculateStartPage(
  sourceType: string,
  apiKey: string,
  mode: "auto" | "full",
): Promise<StartPageResult> {
  const admin = createAdminSupabase();
  const config = MFDS_API_CONFIGS[sourceType];
  if (!config) throw new Error(`Unknown source type: ${sourceType}`);

  if (mode === "full") {
    await admin
      .from("mfds_sync_checkpoints")
      .upsert({
        source_type: sourceType,
        db_count: 0,
        api_total: 0,
        last_page: 0,
        status: "idle",
        updated_at: new Date().toISOString(),
      });
    return { startPage: 1, apiTotal: 0, dbCount: 0, syncMode: "full" };
  }

  // Read checkpoint
  const { data: cp } = await admin
    .from("mfds_sync_checkpoints")
    .select("*")
    .eq("source_type", sourceType)
    .single();

  // If currently syncing (interrupted), resume from last_page + 1
  if (cp?.status === "syncing") {
    const apiTotal = await fetchApiTotalCount(config, apiKey);
    return {
      startPage: (cp.last_page ?? 0) + 1,
      apiTotal,
      dbCount: cp.db_count ?? 0,
      syncMode: "resume",
    };
  }

  // Fetch API totalCount (single lightweight call)
  const apiTotal = await fetchApiTotalCount(config, apiKey);
  const dbCount = cp?.db_count ?? 0;

  // Nothing new
  if (apiTotal === (cp?.api_total ?? 0) && apiTotal <= dbCount) {
    return { startPage: 0, apiTotal, dbCount, syncMode: "skip" };
  }

  // Incremental: start from where DB left off, minus overlap for safety
  const startPage = Math.max(1, Math.floor(dbCount / PAGE_SIZE) + 1 - OVERLAP_PAGES);
  return { startPage, apiTotal, dbCount, syncMode: "incremental" };
}

// ---------------------------------------------------------------------------
// Full sync for a single source type (time-budget aware, resumable)
// ---------------------------------------------------------------------------

/** Max time (ms) to spend in a single invocation before yielding */
const TIME_BUDGET_MS = 200_000; // ~3.3 minutes (leaves 100s buffer for maxDuration=300)

export interface SyncProgress {
  totalFetched: number;
  totalUpserted: number;
  currentPage: number;
  durationMs: number;
}

export interface SyncResult {
  totalFetched: number;
  totalUpserted: number;
  /** "completed" if all pages done, "partial" if stopped early due to time budget */
  outcome: "completed" | "partial";
  /** Next page to resume from (only set when outcome is "partial") */
  nextPage: number | null;
}

export async function runFullSync(
  sourceType: string,
  apiKey: string,
  logId: number,
  startPage = 1,
  /** Cumulative totals from prior invocations (for the same logId) */
  priorFetched = 0,
  priorUpserted = 0,
  onProgress?: (progress: SyncProgress) => void,
  apiTotal = 0,
): Promise<SyncResult> {
  const admin = createAdminSupabase();

  const config = MFDS_API_CONFIGS[sourceType];
  if (!config) throw new Error(`Unknown source type: ${sourceType}`);

  const startTime = Date.now();
  let totalFetched = priorFetched;
  let totalUpserted = priorUpserted;
  let currentPage = startPage;
  let lastTotalCount = apiTotal; // track latest API totalCount
  let outcome: "completed" | "partial" = "completed";

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Time budget check — update DB IMMEDIATELY and return before Vercel kills us.
      // Critical: Do NOT break-then-update. The post-loop code may never execute
      // because Vercel can terminate the after() context at any time.
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        await admin
          .from("mfds_sync_logs")
          .update({
            status: "partial",
            total_fetched: totalFetched,
            total_upserted: totalUpserted,
            duration_ms: Date.now() - startTime,
            next_page: currentPage,
          })
          .eq("id", logId);

        // Update checkpoint for resume
        await admin
          .from("mfds_sync_checkpoints")
          .upsert({
            source_type: sourceType,
            last_page: currentPage - 1,
            db_count: totalFetched,
            api_total: lastTotalCount,
            status: "syncing",
            updated_at: new Date().toISOString(),
          });

        onProgress?.({
          totalFetched,
          totalUpserted,
          currentPage,
          durationMs: Date.now() - startTime,
        });

        return {
          totalFetched,
          totalUpserted,
          outcome: "partial",
          nextPage: currentPage,
        };
      }

      const { items, totalCount } = await fetchPage(config, apiKey, currentPage);
      if (totalCount > 0) lastTotalCount = totalCount;

      if (items.length === 0) break;
      totalFetched += items.length;

      const rows = items
        .map((item) => {
          const sourceKey = String(item[config.sourceKeyField] ?? "");
          if (!sourceKey) return null;
          return {
            source_type: sourceType,
            source_key: sourceKey,
            item_name: String(item[config.itemNameField] ?? ""),
            manufacturer: String(item[config.manufacturerField] ?? ""),
            standard_code: String(item[config.standardCodeField] ?? ""),
            permit_date: String(item[config.permitDateField] ?? ""),
            raw_data: item,
            synced_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (rows.length > 0) {
        const { error, count } = await admin
          .from("mfds_items")
          .upsert(rows, {
            onConflict: "source_type,source_key",
            count: "exact",
          });

        if (error) {
          console.error("UPSERT error:", error.message);
        } else {
          totalUpserted += count ?? rows.length;
        }
      }

      // Update progress in DB and notify caller
      await admin
        .from("mfds_sync_logs")
        .update({
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          duration_ms: Date.now() - startTime,
        })
        .eq("id", logId);

      // Update checkpoint
      await admin
        .from("mfds_sync_checkpoints")
        .upsert({
          source_type: sourceType,
          last_page: currentPage,
          db_count: totalFetched,
          api_total: lastTotalCount,
          status: "syncing",
          updated_at: new Date().toISOString(),
        });

      onProgress?.({
        totalFetched,
        totalUpserted,
        currentPage,
        durationMs: Date.now() - startTime,
      });

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      currentPage++;
      if (currentPage > totalPages) break;
    }

    // All pages completed
    await admin
      .from("mfds_sync_logs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        duration_ms: Date.now() - startTime,
        next_page: null,
      })
      .eq("id", logId);

    // Finalize checkpoint
    const { count: finalCount } = await admin
      .from("mfds_items")
      .select("id", { count: "exact", head: true })
      .eq("source_type", sourceType);

    await admin
      .from("mfds_sync_checkpoints")
      .upsert({
        source_type: sourceType,
        last_page: currentPage - 1,
        db_count: finalCount ?? totalFetched,
        api_total: lastTotalCount,
        status: "completed",
        updated_at: new Date().toISOString(),
      });

    return {
      totalFetched,
      totalUpserted,
      outcome: "completed",
      nextPage: null,
    };
  } catch (err) {
    await admin
      .from("mfds_sync_logs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        duration_ms: Date.now() - startTime,
      })
      .eq("id", logId);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Create sync log entry
// ---------------------------------------------------------------------------

export async function createSyncLog(
  triggerType: "manual" | "cron",
  sourceType: string,
): Promise<number> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("mfds_sync_logs")
    .insert({
      trigger_type: triggerType,
      source_type: sourceType,
      status: "running",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("동기화 로그 생성 실패");
  return data.id;
}

// ---------------------------------------------------------------------------
// Get API key from settings table
// ---------------------------------------------------------------------------

export async function getMfdsApiKeyFromDb(): Promise<string> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();

  if (!data?.value) throw new Error("MFDS API 키가 설정되지 않았습니다.");
  return data.value;
}
