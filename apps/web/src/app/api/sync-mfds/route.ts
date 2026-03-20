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

  let logId: number;
  let syncMode: SyncMode;
  let startPage: number;
  let priorFetched: number;
  let priorUpserted: number;

  // Check for resumable sync (partial, error, or cancelled with next_page)
  const { data: resumable } = await admin
    .from("mfds_sync_logs")
    .select("id, status, sync_mode, next_page, total_fetched, total_upserted")
    .eq("source_type", sourceType)
    .in("status", ["partial", "error", "cancelled"])
    .not("next_page", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resumable) {
    // Resume — atomically update to running
    const { data: resumeData, error: resumeErr } = await admin
      .from("mfds_sync_logs")
      .update({ status: "running", error_message: null })
      .eq("id", resumable.id)
      .in("status", ["partial", "error", "cancelled"])
      .select("id")
      .maybeSingle();
    if (resumeErr || !resumeData) {
      return NextResponse.json({ error: "이미 동기화가 진행 중입니다." }, { status: 409 });
    }
    logId = resumable.id;
    syncMode = (resumable.sync_mode as SyncMode) ?? requestedMode;
    startPage = resumable.next_page ?? 1;
    priorFetched = resumable.total_fetched ?? 0;
    priorUpserted = resumable.total_upserted ?? 0;
    console.log(`[Sync API] Resuming logId=${logId} (was ${resumable.status}) from page ${startPage} (${priorFetched} fetched)`);
  } else {
    // New sync — always start at page 1 (UPSERT handles duplicates safely)
    try {
      logId = await createSyncLog("manual", sourceType, requestedMode);
    } catch (err: any) {
      if (err?.code === "23505") {
        return NextResponse.json({ error: "이미 동기화가 진행 중입니다." }, { status: 409 });
      }
      throw err;
    }
    syncMode = requestedMode;
    startPage = 1;
    priorFetched = 0;
    priorUpserted = 0;
    console.log(`[Sync API] New ${syncMode} sync logId=${logId}, starting page 1`);
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
    resuming: !!resumable,
    startPage,
    priorFetched,
  });
}
