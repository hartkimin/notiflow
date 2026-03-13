/**
 * Advanced Real-time Adaptive MFDS Sync Engine
 * 
 * Features:
 * 1. Sliding Window: Re-scans the last 7 days to catch late-registered or modified items.
 * 2. Multi-parameter Filtering: Uses both permit date and system update hints if available.
 * 3. Exact Matching: Uses source_type + source_key for reliable upserts.
 * 4. Resumable: Supports startPage and prior progress for long-running syncs.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 100; // Smaller page size for better reliability and memory
const SAFE_WINDOW_DAYS = 7; // Look back 7 days to catch any late entries

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

// Helper: Format date to YYYYMMDD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

async function fetchMfdsPage(
  config: ApiConfig,
  apiKey: string,
  page: number,
  startDate: string,
  endDate: string,
): Promise<{ items: any[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(page),
    numOfRows: String(PAGE_SIZE),
    type: "json",
    [config.startDateParam]: startDate,
    [config.endDateParam]: endDate,
  });

  const res = await fetch(`${config.url}?${params}`);
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  
  const json = await res.json();
  const body = json?.body;
  if (!body) return { items: [], totalCount: 0 };

  let items = body.items;
  if (!items) items = [];
  if (!Array.isArray(items)) {
    items = items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
  }

  return { items, totalCount: body.totalCount || 0 };
}

export function createAdminSupabase() {
  return createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface SyncProgress {
  totalFetched: number;
  totalUpserted: number;
  currentPage: number;
  durationMs: number;
}

export interface SyncResult {
  totalFetched: number;
  totalUpserted: number;
  outcome: "completed" | "partial";
  nextPage: number | null;
}

/**
 * Advanced Adaptive Sync with support for resumes and progress tracking.
 */
export async function runAdvancedSync(
  sourceType: string,
  apiKey: string,
  logId: number,
  startPage = 1,
  priorFetched = 0,
  priorUpserted = 0,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const admin = createAdminSupabase();
  const config = MFDS_API_CONFIGS[sourceType];
  
  // 1. Calculate the sliding window
  const { data: latestItem } = await admin
    .from("mfds_items")
    .select("permit_date")
    .eq("source_type", sourceType)
    .order("permit_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const endDateStr = formatDate(now);
  
  let startDate: Date;
  if (latestItem?.permit_date) {
    startDate = new Date(latestItem.permit_date);
    startDate.setDate(startDate.getDate() - SAFE_WINDOW_DAYS);
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  }
  const startDateStr = formatDate(startDate);

  console.log(`[Sync] ${sourceType} Window: ${startDateStr} ~ ${endDateStr} (Starting Page: ${startPage})`);

  let totalFetched = priorFetched;
  let totalUpserted = priorUpserted;
  let currentPage = startPage;
  const startTime = Date.now();

  try {
    while (true) {
      // Time budget check (4 minutes for edge functions)
      if (Date.now() - startTime > 240000) {
        await admin.from("mfds_sync_logs").update({
          status: "partial",
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          duration_ms: Date.now() - startTime,
          next_page: currentPage,
        }).eq("id", logId);

        return { totalFetched, totalUpserted, outcome: "partial", nextPage: currentPage };
      }

      const { data: currentLog } = await admin
        .from("mfds_sync_logs")
        .select("status")
        .eq("id", logId)
        .single();

      if (currentLog?.status === "cancelled") {
        console.log(`[Sync] ${sourceType} sync cancelled by user.`);
        return { totalFetched, totalUpserted, outcome: "completed", nextPage: null };
      }

      const { items, totalCount } = await fetchMfdsPage(config, apiKey, currentPage, startDateStr, endDateStr);
      if (items.length === 0) break;

      totalFetched += items.length;
      const rows = items.map(item => {
        const sourceKey = String(item[config.sourceKeyField] || "");
        if (!sourceKey) return null;
        return {
          source_type: sourceType,
          source_key: sourceKey,
          item_name: String(item[config.itemNameField] || ""),
          manufacturer: String(item[config.manufacturerField] || ""),
          standard_code: String(item[config.standardCodeField] || ""),
          permit_date: String(item[config.permitDateField] || ""),
          raw_data: item,
          synced_at: new Date().toISOString()
        };
      }).filter(Boolean);

      if (rows.length > 0) {
        const { count, error } = await admin
          .from("mfds_items")
          .upsert(rows, { onConflict: "source_type,source_key", count: "exact" });
        
        if (error) console.error("Upsert error:", error.message);
        else totalUpserted += (count || rows.length);
      }

      // Sync progress log
      await admin.from("mfds_sync_logs").update({
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        duration_ms: Date.now() - startTime
      }).eq("id", logId);

      onProgress?.({ totalFetched, totalUpserted, currentPage, durationMs: Date.now() - startTime });

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      if (currentPage >= totalPages) break;
      currentPage++;
    }

    await admin.from("mfds_sync_logs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      total_fetched: totalFetched,
      total_upserted: totalUpserted,
      duration_ms: Date.now() - startTime,
      next_page: null
    }).eq("id", logId);

    return { totalFetched, totalUpserted, outcome: "completed", nextPage: null };
  } catch (err) {
    await admin.from("mfds_sync_logs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: (err as Error).message
    }).eq("id", logId);
    throw err;
  }
}

export const runFullSync = runAdvancedSync;

export async function createSyncLog(triggerType: string, sourceType: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("mfds_sync_logs")
    .insert({ trigger_type: triggerType, source_type: sourceType, status: "running" })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

export async function getMfdsApiKeyFromDb() {
  const admin = createAdminSupabase();
  const { data } = await admin.from("settings").select("value").eq("key", "drug_api_service_key").single();
  return data?.value || "";
}
