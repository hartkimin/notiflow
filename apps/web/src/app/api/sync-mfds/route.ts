import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MFDS_API_CONFIGS,
  runSync,
  createSyncLog,
  createAdminSupabase,
  type SyncMode,
} from "@/lib/mfds-sync";

export async function POST(req: Request) {
  const body = await req.json();
  const sourceType: string = body.sourceType;
  const syncMode: SyncMode = body.syncMode ?? "full";
  const continueLogId: number | undefined = body.logId;
  const startPage: number = body.startPage ?? 1;
  const priorFetched: number = body.priorFetched ?? 0;
  const priorUpserted: number = body.priorUpserted ?? 0;

  if (!sourceType || !MFDS_API_CONFIGS[sourceType]) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: setting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  if (!setting?.value) {
    return NextResponse.json({ error: "MFDS API 키가 설정되지 않았습니다." }, { status: 400 });
  }

  const logId = continueLogId ?? await createSyncLog("manual", sourceType, syncMode);
  if (continueLogId) {
    await admin.from("mfds_sync_logs")
      .update({ status: "running" })
      .eq("id", continueLogId);
  }

  // Stream is UI-only — sync must NEVER fail because of stream errors.
  // If client disconnects, sync continues silently (progress saved to DB).
  const encoder = new TextEncoder();
  let streamAlive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (!streamAlive) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch {
          // Client disconnected — stop sending but do NOT stop sync
          streamAlive = false;
        }
      };

      send({ type: "start", logId, syncMode });

      // Run sync — onProgress errors are swallowed (stream-only)
      try {
        const result = await runSync(
          sourceType,
          setting.value,
          logId,
          syncMode,
          startPage,
          priorFetched,
          priorUpserted,
          (p) => {
            // Progress callback — safe to fail silently
            try { send({ type: "progress", ...p }); } catch { streamAlive = false; }
          },
        );
        send({ type: "done", ...result });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      }

      // Close stream
      if (streamAlive) {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      streamAlive = false;
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
