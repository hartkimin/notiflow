"use server";

import { getSalesRepPerformance, getHospitalRanking } from "@/lib/queries/dashboard-stats";
import { createClient } from "@/lib/supabase/server";

export async function getSalesRepByMonthAction(month: string) {
  return getSalesRepPerformance(month);
}

export async function getHospitalRankByMonthAction(month: string) {
  return getHospitalRanking(10, month);
}

// ─── 일별 매출 추이 ───

export interface DailySalesTrend {
  day: string; // "1", "2", ... "31"
  supply_amount: number;
  profit_amount: number;
  profit_margin: number;
}

export async function getDailySalesTrendAction(month: string): Promise<DailySalesTrend[]> {
  const supabase = await createClient();
  const [y, m] = month.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = new Date(y, m, 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  // Get orders for the month
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_date")
    .gte("order_date", monthStart)
    .lt("order_date", nextMonthStr)
    .not("status", "eq", "cancelled");

  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);

  // Get order_items for revenue + purchase
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, quantity, unit_price, purchase_price")
    .in("order_id", orderIds);

  // Build order_id → day mapping
  const orderDayMap = new Map<number, number>();
  for (const o of orders) {
    orderDayMap.set(o.id, new Date(o.order_date).getDate());
  }

  // Aggregate by day
  const dayMap = new Map<number, { revenue: number; purchase: number }>();
  for (const item of items ?? []) {
    const day = orderDayMap.get(item.order_id);
    if (!day) continue;
    if (!dayMap.has(day)) dayMap.set(day, { revenue: 0, purchase: 0 });
    const entry = dayMap.get(day)!;
    entry.revenue += Math.round(Number(item.unit_price ?? 0) * 1.1) * (item.quantity ?? 0);
    entry.purchase += Math.round(Number(item.purchase_price ?? 0) * 1.1) * (item.quantity ?? 0);
  }

  // Fill all days of the month
  const daysInMonth = new Date(y, m, 0).getDate();
  const result: DailySalesTrend[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = dayMap.get(d);
    const revenue = entry?.revenue ?? 0;
    const purchase = entry?.purchase ?? 0;
    const profit = revenue - purchase;
    result.push({
      day: String(d),
      supply_amount: revenue,
      profit_amount: profit,
      profit_margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    });
  }

  return result;
}
