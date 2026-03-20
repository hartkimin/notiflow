import { NextResponse } from "next/server";
import {
  runSync,
  cleanupStaleLogs,
  findResumableSync,
  getMfdsApiKeyFromDb,
  createAdminSupabase,
} from "@/lib/mfds-sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await cleanupStaleLogs();

  const resumable = await findResumableSync();
  if (!resumable) {
    return NextResponse.json({ ok: true, message: "No resumable syncs" });
  }

  let apiKey: string;
  try {
    apiKey = await getMfdsApiKeyFromDb();
  } catch {
    return NextResponse.json({ error: "API 키 없음" }, { status: 500 });
  }

  const admin = createAdminSupabase();
  // Atomically update to running
  const { data: resumed, error: resumeErr } = await admin
    .from("mfds_sync_logs")
    .update({ status: "running", error_message: null })
    .eq("id", resumable.id)
    .in("status", ["partial", "error", "cancelled"])
    .select("id")
    .maybeSingle();
  if (resumeErr || !resumed) {
    return NextResponse.json({ ok: true, message: "Sync already running" });
  }

  await runSync(
    resumable.source_type,
    apiKey,
    resumable.id,
    (resumable.sync_mode as "full" | "incremental") ?? "full",
    resumable.next_page ?? 1,
    resumable.total_fetched ?? 0,
    resumable.total_upserted ?? 0,
  );

  return NextResponse.json({ ok: true, continued: resumable.id });
}
