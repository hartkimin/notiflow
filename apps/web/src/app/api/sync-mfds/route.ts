import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
} from "@/lib/mfds-sync";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const sourceType: string = body.sourceType;
  const continueLogId: number | undefined = body.logId;
  const startPage: number = body.startPage ?? 1;
  const priorFetched: number = body.priorFetched ?? 0;
  const priorUpserted: number = body.priorUpserted ?? 0;
  const internalSecret: string | undefined = body._internalSecret;

  if (!sourceType || !MFDS_API_CONFIGS[sourceType]) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  // Auth — either user session (manual) or internal continuation secret
  const isInternalContinuation =
    internalSecret === process.env.CRON_SECRET && !!continueLogId;

  if (!isInternalContinuation) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
  }

  // Get API key
  const { createAdminSupabase } = await import("@/lib/mfds-sync");
  const admin = createAdminSupabase();
  const { data: setting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  if (!setting?.value) {
    return NextResponse.json(
      { error: "MFDS API 키가 설정되지 않았습니다." },
      { status: 400 },
    );
  }

  // Create or reuse sync log
  const logId = continueLogId ?? await createSyncLog("manual", sourceType);

  // Run sync in background with self-continuation
  after(async () => {
    const result = await runFullSync(
      sourceType,
      setting.value,
      logId,
      startPage,
      priorFetched,
      priorUpserted,
    );

    // If partial (time budget exceeded), trigger a continuation call
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
        console.error("Continuation trigger failed:", err);
      });
    }
  });

  return NextResponse.json({ logId, started: true });
}
