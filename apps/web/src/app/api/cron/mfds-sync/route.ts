import { NextResponse } from "next/server";
import {
  MFDS_API_CONFIGS,
  runSync,
  createSyncLog,
  cleanupStaleLogs,
  detectSyncMode,
  getMfdsApiKeyFromDb,
} from "@/lib/mfds-sync";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let apiKey: string;
  try {
    apiKey = await getMfdsApiKeyFromDb();
  } catch {
    return NextResponse.json({ error: "API 키 없음" }, { status: 500 });
  }

  await cleanupStaleLogs();

  const results: Record<string, unknown> = {};
  for (const sourceType of Object.keys(MFDS_API_CONFIGS)) {
    try {
      const { mode, reason } = await detectSyncMode(sourceType, apiKey);
      const logId = await createSyncLog("cron", sourceType, mode);
      const result = await runSync(sourceType, apiKey, logId, mode);
      results[sourceType] = { mode, reason, outcome: result.outcome };
    } catch (err) {
      results[sourceType] = { outcome: "error", message: (err as Error).message };
    }
  }

  return NextResponse.json({ ok: true, results });
}
