import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  createAdminSupabase,
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

  // If continuing a partial sync, set status back to "running" immediately
  // (before after() starts) so the client doesn't trigger another continuation
  if (continueLogId) {
    await admin
      .from("mfds_sync_logs")
      .update({ status: "running", next_page: null })
      .eq("id", continueLogId);
  }

  // Run sync in background — no self-continuation.
  // If partial, the sync log will be set to "partial" with next_page,
  // and the client (or continuation cron) will trigger the next chunk.
  after(async () => {
    await runFullSync(
      sourceType,
      setting.value,
      logId,
      startPage,
      priorFetched,
      priorUpserted,
    );
  });

  return NextResponse.json({ logId, started: true });
}
