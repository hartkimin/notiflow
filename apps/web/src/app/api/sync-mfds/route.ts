import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  createAdminSupabase,
  calculateStartPage,
} from "@/lib/mfds-sync";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const sourceType: string = body.sourceType;
  const mode: "auto" | "full" = body.mode ?? "auto";
  const continueLogId: number | undefined = body.logId;
  const explicitStartPage: number | undefined = body.startPage;
  const priorFetched: number = body.priorFetched ?? 0;
  const priorUpserted: number = body.priorUpserted ?? 0;

  if (!sourceType || !MFDS_API_CONFIGS[sourceType]) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  // Auth — user session required
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
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

  // Determine start page — legacy continuation takes priority, then auto-calculate
  let startPage = explicitStartPage ?? 1;
  let calcApiTotal = 0;
  let syncMode: string = mode;

  if (!continueLogId && !explicitStartPage) {
    const calc = await calculateStartPage(sourceType, setting.value, mode);
    if (calc.syncMode === "skip") {
      return new Response(
        JSON.stringify({ type: "done", outcome: "skip", totalFetched: 0, totalUpserted: 0, syncMode: "skip" }) + "\n",
        { headers: { "Content-Type": "application/x-ndjson" } },
      );
    }
    startPage = calc.startPage;
    calcApiTotal = calc.apiTotal;
    syncMode = calc.syncMode;
  }

  // Create or reuse sync log
  const logId = continueLogId ?? await createSyncLog("manual", sourceType);

  // If continuing a partial sync, set status back to "running"
  if (continueLogId) {
    await admin
      .from("mfds_sync_logs")
      .update({ status: "running", next_page: null })
      .eq("id", continueLogId);
  }

  // Stream NDJSON progress events — keeps function alive for full duration
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      send({ type: "start", logId, startPage, apiTotal: calcApiTotal, syncMode });

      try {
        const result = await runFullSync(
          sourceType,
          setting.value,
          logId,
          startPage,
          priorFetched,
          priorUpserted,
          (progress) => send({ type: "progress", ...progress, apiTotal: calcApiTotal, syncMode }),
          calcApiTotal,
        );
        send({ type: "done", ...result, apiTotal: calcApiTotal, syncMode });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
