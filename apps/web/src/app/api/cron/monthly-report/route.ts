import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Vercel Cron: runs on the 1st of each month at 01:00 KST (16:00 UTC prev day)
// Generates the previous month's sales report

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

  // Calculate previous month
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  // Generate sales report via RPC
  const { data: report, error: reportError } = await supabase.rpc(
    "get_sales_report",
    { target_period: period },
  );

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  // Store in sales_reports
  const { error: upsertError } = await supabase
    .from("sales_reports")
    .upsert(
      {
        report_date: `${period}-01`,
        report_type: "monthly",
        data: report,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "report_date,report_type" },
    );

  if (upsertError) {
    console.error("Failed to store monthly report:", upsertError.message);
  }

  return NextResponse.json({
    ok: true,
    period,
    summary: report?.summary,
  });
}
