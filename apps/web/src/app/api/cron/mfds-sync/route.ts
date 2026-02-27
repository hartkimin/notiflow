import { NextResponse } from "next/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  createAdminSupabase,
  getMfdsApiKeyFromDb,
} from "@/lib/mfds-sync";

// Vercel Cron: runs daily at 04:00 KST (19:00 UTC)
// 1. First checks for any "partial" sync logs and continues them
// 2. If none, starts a new sync for each source type sequentially
// 3. Also cleans up stale "running" logs

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let apiKey: string;
  try {
    apiKey = await getMfdsApiKeyFromDb();
  } catch {
    return NextResponse.json(
      { error: "MFDS API 키가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const admin = createAdminSupabase();

  // Clean up stale "running" logs (started > 7 min ago, function is dead)
  const staleThreshold = new Date(Date.now() - 7 * 60 * 1000).toISOString();
  await admin
    .from("mfds_sync_logs")
    .update({
      status: "error",
      error_message: "동기화 시간 초과 (비정상 종료)",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", staleThreshold);

  // Check for partial sync logs first
  const { data: partialLogs } = await admin
    .from("mfds_sync_logs")
    .select("id, source_type, next_page, total_fetched, total_upserted")
    .eq("status", "partial")
    .order("started_at", { ascending: true })
    .limit(1);

  if (partialLogs?.length) {
    const log = partialLogs[0];

    // Update status to "running" before starting
    await admin
      .from("mfds_sync_logs")
      .update({ status: "running", next_page: null })
      .eq("id", log.id);

    await runFullSync(
      log.source_type,
      apiKey,
      log.id,
      log.next_page ?? 1,
      log.total_fetched ?? 0,
      log.total_upserted ?? 0,
    );

    return NextResponse.json({ ok: true, continuing: log.id });
  }

  // No partial syncs — start fresh sync for each source type
  const sourceTypes = Object.keys(MFDS_API_CONFIGS);

  for (const sourceType of sourceTypes) {
    const logId = await createSyncLog("cron", sourceType);
    try {
      const result = await runFullSync(sourceType, apiKey, logId);
      if (result.outcome === "partial") {
        // Stop — next cron invocation will continue this partial sync
        break;
      }
    } catch (err) {
      console.error(`Cron sync failed for ${sourceType}:`, (err as Error).message);
    }
  }

  return NextResponse.json({ ok: true, sourceTypes });
}
