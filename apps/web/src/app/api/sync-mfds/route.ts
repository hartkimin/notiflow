import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MFDS_API_CONFIGS,
  runSync,
  createSyncLog,
  createAdminSupabase,
  cleanupStaleLogs,
  type SyncMode,
} from "@/lib/mfds-sync";

export async function POST(req: Request) {
  const body = await req.json();
  const sourceType: string = body.sourceType;
  const requestedMode: SyncMode = body.syncMode ?? "full";

  if (!sourceType || !MFDS_API_CONFIGS[sourceType]) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: setting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  if (!setting?.value) {
    return NextResponse.json({ error: "MFDS API 키가 설정되지 않았습니다." }, { status: 400 });
  }

  // Clean up stale logs first
  await cleanupStaleLogs();

  // Check if there's already a running sync
  const { data: running } = await admin
    .from("mfds_sync_logs")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();

  if (running) {
    return NextResponse.json({ error: "이미 동기화가 진행 중입니다.", logId: running.id }, { status: 409 });
  }

  // Auto-detect partial sync for this source type
  const { data: partial } = await admin
    .from("mfds_sync_logs")
    .select("id, sync_mode, next_page, total_fetched, total_upserted")
    .eq("source_type", sourceType)
    .eq("status", "partial")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let logId: number;
  let syncMode: SyncMode;
  let startPage: number;
  let priorFetched: number;
  let priorUpserted: number;

  if (partial) {
    logId = partial.id;
    syncMode = (partial.sync_mode as SyncMode) ?? requestedMode;
    startPage = partial.next_page ?? 1;
    priorFetched = partial.total_fetched ?? 0;
    priorUpserted = partial.total_upserted ?? 0;
    await admin.from("mfds_sync_logs").update({ status: "running" }).eq("id", logId);
    console.log(`[Sync API] Resuming logId=${logId} from page ${startPage} (${priorFetched} fetched)`);
  } else {
    const { count: existingCount } = await admin
      .from("mfds_items")
      .select("id", { count: "exact", head: true })
      .eq("source_type", sourceType);

    const alreadyFetched = existingCount ?? 0;
    startPage = alreadyFetched > 0 ? Math.floor(alreadyFetched / 500) + 1 : 1;

    logId = await createSyncLog("manual", sourceType, requestedMode);
    syncMode = requestedMode;
    priorFetched = 0;
    priorUpserted = 0;
    console.log(`[Sync API] New ${syncMode} sync logId=${logId} — DB has ${alreadyFetched} items, starting page ${startPage}`);
  }

  // Fire-and-forget: run sync in background, independent of HTTP connection
  runSync(
    sourceType,
    setting.value,
    logId,
    syncMode,
    startPage,
    priorFetched,
    priorUpserted,
  ).then((result) => {
    console.log(`[Sync API] Background sync logId=${logId} finished: ${result.outcome} — ${result.totalFetched} fetched, ${result.totalUpserted} upserted`);
  }).catch((err) => {
    console.error(`[Sync API] Background sync logId=${logId} failed:`, err);
  });

  // Return immediately — client polls /api/sync-mfds/status for progress
  return NextResponse.json({
    logId,
    syncMode,
    resuming: !!partial,
    startPage,
    priorFetched,
  });
}
