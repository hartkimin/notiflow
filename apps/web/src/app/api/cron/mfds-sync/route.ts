import { after, NextResponse } from "next/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  getMfdsApiKeyFromDb,
} from "@/lib/mfds-sync";

// Vercel Cron: runs daily at 04:00 KST (19:00 UTC)
// Syncs each source type sequentially. If a source type hits the time budget,
// it is marked as "partial" and the continuation cron picks it up.

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

  const sourceTypes = Object.keys(MFDS_API_CONFIGS);

  // Run syncs in background — create logs one at a time.
  // If a source type is partial, stop and let the continuation cron handle it.
  after(async () => {
    for (const sourceType of sourceTypes) {
      const logId = await createSyncLog("cron", sourceType);
      try {
        const result = await runFullSync(sourceType, apiKey, logId);
        if (result.outcome === "partial") {
          // Stop processing more source types — continuation cron will resume
          break;
        }
      } catch (err) {
        console.error(`Cron sync failed for ${sourceType}:`, (err as Error).message);
      }
    }
  });

  return NextResponse.json({ ok: true, sourceTypes });
}
