import { after, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300; // 5 minutes (Vercel Pro)

// ---------------------------------------------------------------------------
// MFDS API config (mirrors the server action version)
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

const API_CONFIGS: Record<string, ApiConfig> = {
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
// Full sync loop (runs in background via after())
// ---------------------------------------------------------------------------

async function runFullSync(
  sourceType: string,
  apiKey: string,
  logId: number,
) {
  // Use raw Supabase client (no cookies needed for background task)
  const admin = createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const config = API_CONFIGS[sourceType];
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

      // Update progress every page so frontend polling can see it
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
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Auth check — verify user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  // 2. Parse request
  const body = await req.json();
  const sourceType: string = body.sourceType;
  if (!sourceType || !API_CONFIGS[sourceType]) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  // 3. Get API key
  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  if (!setting?.value) {
    return NextResponse.json(
      { error: "MFDS API 키가 설정되지 않았습니다." },
      { status: 400 },
    );
  }
  const apiKey = setting.value;

  // 4. Create sync log (admin client for RLS bypass)
  const admin = createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: logEntry, error: logError } = await admin
    .from("mfds_sync_logs")
    .insert({
      trigger_type: "manual",
      source_type: sourceType,
      status: "running",
    })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return NextResponse.json(
      { error: "동기화 로그 생성 실패" },
      { status: 500 },
    );
  }

  // 5. Schedule background sync — runs after response is sent
  after(async () => {
    await runFullSync(sourceType, apiKey, logEntry.id);
  });

  // 6. Respond immediately
  return NextResponse.json({ logId: logEntry.id, started: true });
}
