import { NextResponse } from "next/server";
import {
  runSync,
  cleanupStaleLogs,
  findPartialSync,
  getMfdsApiKeyFromDb,
  createAdminSupabase,
} from "@/lib/mfds-sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await cleanupStaleLogs();

  const partial = await findPartialSync();
  if (!partial) {
    return NextResponse.json({ ok: true, message: "No partial syncs" });
  }

  let apiKey: string;
  try {
    apiKey = await getMfdsApiKeyFromDb();
  } catch {
    return NextResponse.json({ error: "API 키 없음" }, { status: 500 });
  }

  const admin = createAdminSupabase();
  // Atomically update only if still partial
  const { data: resumed, error: resumeErr } = await admin
    .from("mfds_sync_logs")
    .update({ status: "running" })
    .eq("id", partial.id)
    .eq("status", "partial")
    .select("id")
    .maybeSingle();
  if (resumeErr || !resumed) {
    return NextResponse.json({ ok: true, message: "Sync already running or no longer partial" });
  }

  await runSync(
    partial.source_type,
    apiKey,
    partial.id,
    (partial.sync_mode as "full" | "incremental") ?? "full",
    partial.next_page ?? 1,
    partial.total_fetched ?? 0,
    partial.total_upserted ?? 0,
  );

  return NextResponse.json({ ok: true, continued: partial.id });
}
