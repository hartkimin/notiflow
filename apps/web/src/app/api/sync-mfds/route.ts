import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
} from "@/lib/mfds-sync";

export const maxDuration = 300;

export async function POST(req: Request) {
  // 1. Auth — verify user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  // 2. Parse request
  const body = await req.json();
  const sourceType: string = body.sourceType;
  if (!sourceType || !MFDS_API_CONFIGS[sourceType]) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  // 3. Get API key
  const { data: setting } = await supabase
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

  // 4. Create sync log
  const logId = await createSyncLog("manual", sourceType);

  // 5. Run sync in background
  after(async () => {
    await runFullSync(sourceType, setting.value, logId);
  });

  return NextResponse.json({ logId, started: true });
}
