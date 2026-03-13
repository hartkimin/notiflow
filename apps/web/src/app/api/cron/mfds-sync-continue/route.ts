import { after, NextResponse } from "next/server";
import {
  runFullSync,
  createAdminSupabase,
  getMfdsApiKeyFromDb,
} from "@/lib/mfds-sync";

// Continuation cron: runs every 10 minutes.
// Picks up any sync logs stuck as "partial" and continues them.
// Also cleans up stale "running" logs that were never completed.

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();

  // Clean up stale "running" logs (started > 7 min ago, never finished).
  // maxDuration is 300s (5min), so anything running > 7min is dead.
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

  // Find the oldest partial sync log
  const { data: partialLogs } = await admin
    .from("mfds_sync_logs")
    .select("id, source_type, next_page, total_fetched, total_upserted")
    .eq("status", "partial")
    .order("started_at", { ascending: true })
    .limit(1);

  if (!partialLogs?.length) {
    return NextResponse.json({ ok: true, message: "No partial syncs" });
  }

  const log = partialLogs[0];

  let apiKey: string;
  try {
    apiKey = await getMfdsApiKeyFromDb();
  } catch {
    return NextResponse.json(
      { error: "MFDS API 키가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  // Update status to "running" before starting
  await admin
    .from("mfds_sync_logs")
    .update({ status: "running", next_page: null })
    .eq("id", log.id);

  after(async () => {
    await runFullSync(
      log.source_type,
      apiKey,
      log.id,
      log.next_page ?? 1,
      log.total_fetched ?? 0,
      log.total_upserted ?? 0,
    );
  });

  return NextResponse.json({ ok: true, continuing: log.id });
}
