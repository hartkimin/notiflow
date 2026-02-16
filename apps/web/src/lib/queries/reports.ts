import { createClient } from "@/lib/supabase/server";
import type { SalesReport, KpisReport } from "@/lib/types";

export async function getSalesReport(period: string): Promise<SalesReport> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_report", {
    target_period: period,
  });
  if (error) throw error;
  return data as SalesReport;
}

export async function getPendingKpis(): Promise<{ count: number; reports: KpisReport[] }> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("kpis_reports")
    .select("*, order_items(*, orders(order_number, hospitals(name)))", { count: "exact" })
    .eq("report_status", "pending")
    .order("created_at");

  if (error) throw error;
  return { count: count ?? 0, reports: (data ?? []) as KpisReport[] };
}

export async function getOverdueKpis(days = 7): Promise<{ count: number; reports: KpisReport[] }> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, count, error } = await supabase
    .from("kpis_reports")
    .select("*, order_items(*, orders(order_number, hospitals(name)))", { count: "exact" })
    .eq("report_status", "pending")
    .lt("created_at", cutoff.toISOString())
    .order("created_at");

  if (error) throw error;
  return { count: count ?? 0, reports: (data ?? []) as KpisReport[] };
}

export async function markKpisReported(
  id: number,
  data: { reference_number?: string; notes?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("kpis_reports")
    .update({
      report_status: "reported",
      reported_at: new Date().toISOString(),
      ...data,
    })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}
