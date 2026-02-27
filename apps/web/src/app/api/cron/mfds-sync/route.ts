import { after, NextResponse } from "next/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  getMfdsApiKeyFromDb,
} from "@/lib/mfds-sync";

// Vercel Cron: runs daily at 04:00 KST (19:00 UTC)
// Syncs both drug and device_std from MFDS API into mfds_items table

export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get API key
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

  // Run all syncs in background (sequentially to avoid API rate limits)
  after(async () => {
    for (const { sourceType, logId } of logs) {
      try {
        await runFullSync(sourceType, apiKey, logId);
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
