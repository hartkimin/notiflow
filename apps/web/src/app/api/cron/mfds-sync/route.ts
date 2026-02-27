import { after, NextResponse } from "next/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  getMfdsApiKeyFromDb,
} from "@/lib/mfds-sync";

// Vercel Cron: runs daily at 04:00 KST (19:00 UTC)
// Syncs drug then device_std sequentially with automatic continuation

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

  // Create sync logs for each source type
  const sourceTypes = Object.keys(MFDS_API_CONFIGS);
  const logs: { sourceType: string; logId: number }[] = [];

  for (const sourceType of sourceTypes) {
    const logId = await createSyncLog("cron", sourceType);
    logs.push({ sourceType, logId });
  }

  // Run syncs in background — first source type starts immediately,
  // if it hits the time budget, the /api/sync-mfds self-continuation handles it.
  // Second source type is triggered via self-continuation after the first completes.
  after(async () => {
    for (const { sourceType, logId } of logs) {
      try {
        const result = await runFullSync(sourceType, apiKey, logId);

        // If partial, trigger continuation via the manual sync route
        if (result.outcome === "partial" && result.nextPage) {
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

          await fetch(`${baseUrl}/api/sync-mfds`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceType,
              logId,
              startPage: result.nextPage,
              priorFetched: result.totalFetched,
              priorUpserted: result.totalUpserted,
              _internalSecret: process.env.CRON_SECRET,
            }),
          }).catch((err) => {
            console.error("Cron continuation trigger failed:", err);
          });
          // Stop processing more source types in this invocation
          // (the continuation chain will handle the rest)
          break;
        }
      } catch (err) {
        console.error(`Cron sync failed for ${sourceType}:`, (err as Error).message);
      }
    }
  });

  return NextResponse.json({
    ok: true,
    scheduled: logs.map((l) => ({ sourceType: l.sourceType, logId: l.logId })),
  });
}
