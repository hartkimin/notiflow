import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Vercel Cron: runs daily at 23:50 KST (14:50 UTC)
// Generates a daily stats snapshot and stores it in sales_reports

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch daily stats via RPC
  const { data: stats, error: statsError } = await supabase.rpc(
    "get_daily_stats",
    { target_date: today },
  );

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  // Store snapshot in sales_reports (upsert by date)
  const { error: upsertError } = await supabase
    .from("sales_reports")
    .upsert(
      {
        report_date: today,
        report_type: "daily",
        data: stats,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "report_date,report_type" },
    );

  if (upsertError) {
    // sales_reports table might not have the right schema yet;
    // log but don't fail - the stats are still generated
    console.error("Failed to store daily report:", upsertError.message);
  }

  return NextResponse.json({
    ok: true,
    date: today,
    stats,
  });
}
