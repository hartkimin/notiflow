import { createClient } from "@/lib/supabase/server";
import type { HospitalStat, ProductStat, TrendPoint } from "@/lib/types";

export interface DailyStats {
  date: string;
  orders_created: number;
}

export async function getDailyStats(date?: string): Promise<DailyStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_stats", {
    target_date: date || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data as DailyStats;
}

export async function getHospitalStats(fromDate?: string, toDate?: string): Promise<HospitalStat[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("get_hospital_stats", {
    from_date: fromDate || thirtyDaysAgo,
    to_date: toDate || today,
  });
  if (error) throw error;
  return data as HospitalStat[];
}

export async function getProductStats(fromDate?: string, toDate?: string): Promise<ProductStat[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("get_product_stats", {
    from_date: fromDate || thirtyDaysAgo,
    to_date: toDate || today,
  });
  if (error) throw error;
  return data as ProductStat[];
}

export async function getTrendStats(fromDate?: string, toDate?: string): Promise<TrendPoint[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("get_trend_stats", {
    from_date: fromDate || thirtyDaysAgo,
    to_date: toDate || today,
  });
  if (error) throw error;
  return data as TrendPoint[];
}

export interface MonthlySalesTrend {
  month: string;
  order_count: number;
  supply_amount: number;
  profit_amount: number;
  profit_margin: number;
  unissued_tax_invoices: number;
  delivered_amount: number;
  invoiced_amount: number;
  uninvoiced_amount: number;
}

export interface SalesRepStat {
  sales_rep: string;
  sales_amount: number;
  profit_amount: number;
  profit_margin: number;
}

export async function getMonthlySalesTrend(monthsLimit: number = 6): Promise<MonthlySalesTrend[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_sales_trend", {
    months_limit: monthsLimit,
  });
  if (error) throw error;
  return data as MonthlySalesTrend[];
}

export async function getSalesRepStats(targetMonth?: string): Promise<SalesRepStat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_rep_stats", {
    target_month: targetMonth || null,
  });
  if (error) throw error;
  return data as SalesRepStat[];
}
