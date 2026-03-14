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
    // Resume interrupted sync from saved page
    logId = partial.id;
    syncMode = (partial.sync_mode as SyncMode) ?? requestedMode;
    startPage = partial.next_page ?? 1;
    priorFetched = partial.total_fetched ?? 0;
    priorUpserted = partial.total_upserted ?? 0;
    await admin.from("mfds_sync_logs").update({ status: "running" }).eq("id", logId);
    console.log(`[Sync API] Resuming logId=${logId} from page ${startPage} (${priorFetched} fetched)`);
  } else {
    // New sync — calculate start page from existing DB count
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

  // Stream is UI-only — sync continues even if client disconnects
  const encoder = new TextEncoder();
  let streamAlive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (!streamAlive) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch {
          streamAlive = false;
        }
      };

      send({ type: "start", logId, syncMode, resuming: !!partial, startPage, priorFetched });

      try {
        const result = await runSync(
          sourceType,
          setting.value,
          logId,
          syncMode,
          startPage,
          priorFetched,
          priorUpserted,
          (p) => { try { send({ type: "progress", ...p }); } catch { streamAlive = false; } },
        );
        send({ type: "done", ...result });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      }

      if (streamAlive) {
        try { controller.close(); } catch { /* */ }
      }
    },
    cancel() { streamAlive = false; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
