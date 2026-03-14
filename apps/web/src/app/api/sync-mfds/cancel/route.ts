import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/mfds-sync";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { logId } = await req.json();
  const admin = createAdminSupabase();

  if (logId) {
    // Cancel specific sync
    await admin.from("mfds_sync_logs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", logId)
      .in("status", ["running", "partial"]);
  } else {
    // Cancel all active syncs
    await admin.from("mfds_sync_logs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .in("status", ["running", "partial"]);
  }

  return NextResponse.json({ ok: true });
}
