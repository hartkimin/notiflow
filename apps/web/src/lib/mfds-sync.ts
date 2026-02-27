/**
 * Shared MFDS sync logic — used by both manual sync (/api/sync-mfds)
 * and scheduled cron sync (/api/cron/mfds-sync).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

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
// Full sync for a single source type
// ---------------------------------------------------------------------------

export async function runFullSync(
  sourceType: string,
  apiKey: string,
  logId: number,
): Promise<{ totalFetched: number; totalUpserted: number }> {
  const admin = createAdminSupabase();

  const config = MFDS_API_CONFIGS[sourceType];
  if (!config) throw new Error(`Unknown source type: ${sourceType}`);

  const startTime = Date.now();
  let totalFetched = 0;
  let totalUpserted = 0;
  let currentPage = 1;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { items, totalCount } = await fetchPage(config, apiKey, currentPage);

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

      // Update progress so polling can track it
      await admin
        .from("mfds_sync_logs")
        .update({
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          duration_ms: Date.now() - startTime,
        })
        .eq("id", logId);

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      currentPage++;
      if (currentPage > totalPages) break;
    }

    // Mark completed
    await admin
      .from("mfds_sync_logs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        duration_ms: Date.now() - startTime,
      })
      .eq("id", logId);

    return { totalFetched, totalUpserted };
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
