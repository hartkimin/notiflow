import { createClient } from "@/lib/supabase/server";

// ─── 1. KPI 카드 데이터 ───

export interface DashboardKpis {
  // 당월 매출
  monthlyRevenue: number;
  monthlyPurchase: number;
  monthlyProfit: number;
  monthlyProfitMargin: number;
  monthlyOrderCount: number;
  // 전월 대비
  prevMonthRevenue: number;
  revenueGrowth: number; // %
  // 주문 프로세스
  ordersConfirmed: number;
  ordersDelivered: number;
  ordersInvoiced: number;
  // 세금계산서
  invoicesDraft: number;
  invoicesIssued: number;
  unbilledOrders: number;
}

export async function getDashboardKpis(month?: string): Promise<DashboardKpis> {
  const supabase = await createClient();

  // month format: "YYYY-MM", defaults to current month
  let baseYear: number, baseMonth: number;
  if (month) {
    [baseYear, baseMonth] = month.split("-").map(Number);
  } else {
    const now = new Date();
    baseYear = now.getFullYear();
    baseMonth = now.getMonth() + 1;
  }

  const thisMonthStart = `${baseYear}-${String(baseMonth).padStart(2, "0")}-01`;
  const nextMonthStart = (() => {
    const d = new Date(baseYear, baseMonth, 1); // baseMonth is 1-based, Date month is 0-based → next month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const prevMonthStart = (() => {
    const d = new Date(baseYear, baseMonth - 2, 1); // baseMonth-1 is current in 0-based, -2 is previous
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  // Current month orders
  const { data: thisMonthOrders } = await supabase
    .from("orders")
    .select("id, status, supply_amount")
    .gte("order_date", thisMonthStart)
    .lt("order_date", nextMonthStart);

  const orders = thisMonthOrders ?? [];

  // Current month items for purchase calc
  const orderIds = orders.map((o) => o.id);
  let monthlyPurchase = 0;
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, purchase_price")
      .in("order_id", orderIds);
    monthlyPurchase = (items ?? []).reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
  }

  const monthlyRevenue = orders.reduce((s, o) => s + Number(o.supply_amount || 0), 0);
  const monthlyProfit = monthlyRevenue - monthlyPurchase;

  // Previous month revenue
  const { data: prevOrders } = await supabase
    .from("orders")
    .select("supply_amount")
    .gte("order_date", prevMonthStart)
    .lt("order_date", thisMonthStart);

  const prevMonthRevenue = (prevOrders ?? []).reduce((s, o) => s + Number(o.supply_amount || 0), 0);
  const revenueGrowth = prevMonthRevenue > 0 ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  // Order status counts (all time)
  const { data: statusData } = await supabase
    .from("orders")
    .select("status");

  const statusCounts: Record<string, number> = {};
  for (const o of statusData ?? []) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  }

  // Invoice counts
  const { data: invoices } = await supabase
    .from("tax_invoices")
    .select("status");

  let invoicesDraft = 0, invoicesIssued = 0;
  for (const inv of invoices ?? []) {
    if (inv.status === "draft") invoicesDraft++;
    if (inv.status === "issued" || inv.status === "sent") invoicesIssued++;
  }

  // Unbilled orders
  const unbilledOrders = statusCounts.delivered ?? 0;

  return {
    monthlyRevenue,
    monthlyPurchase,
    monthlyProfit,
    monthlyProfitMargin: monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0,
    monthlyOrderCount: orders.length,
    prevMonthRevenue,
    revenueGrowth,
    ordersConfirmed: statusCounts.confirmed ?? 0,
    ordersDelivered: statusCounts.delivered ?? 0,
    ordersInvoiced: statusCounts.invoiced ?? 0,
    invoicesDraft,
    invoicesIssued,
    unbilledOrders,
  };
}

// ─── 2. 거래처별 매출 Top 10 ───

export interface HospitalRanking {
  hospital_id: number;
  hospital_name: string;
  order_count: number;
  revenue: number;
  purchase: number;
  profit: number;
  margin: number;
}

export async function getHospitalRanking(limit = 10): Promise<HospitalRanking[]> {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, hospital_id, supply_amount, hospitals(name)")
    .not("status", "eq", "cancelled");

  if (!orders?.length) return [];

  // Group by hospital
  const map = new Map<number, { name: string; orderIds: number[]; revenue: number }>();
  for (const o of orders) {
    const hid = o.hospital_id;
    const name = (o.hospitals as unknown as { name: string } | null)?.name ?? "";
    if (!map.has(hid)) map.set(hid, { name, orderIds: [], revenue: 0 });
    const entry = map.get(hid)!;
    entry.orderIds.push(o.id);
    entry.revenue += Number(o.supply_amount || 0);
  }

  // Get purchase for all order items
  const allOrderIds = orders.map((o) => o.id);
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, quantity, purchase_price")
    .in("order_id", allOrderIds);

  const purchaseByOrder = new Map<number, number>();
  for (const item of items ?? []) {
    purchaseByOrder.set(item.order_id, (purchaseByOrder.get(item.order_id) || 0) + (item.purchase_price ?? 0) * item.quantity);
  }

  const result: HospitalRanking[] = [];
  for (const [hid, entry] of map) {
    const purchase = entry.orderIds.reduce((s, id) => s + (purchaseByOrder.get(id) || 0), 0);
    const profit = entry.revenue - purchase;
    result.push({
      hospital_id: hid,
      hospital_name: entry.name,
      order_count: entry.orderIds.length,
      revenue: entry.revenue,
      purchase,
      profit,
      margin: entry.revenue > 0 ? (profit / entry.revenue) * 100 : 0,
    });
  }

  return result.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

// ─── 3. 영업담당자별 실적 ───

export interface SalesRepPerformance {
  sales_rep: string;
  order_count: number;
  revenue: number;
  purchase: number;
  profit: number;
  margin: number;
}

export async function getSalesRepPerformance(month?: string): Promise<SalesRepPerformance[]> {
  const supabase = await createClient();

  // If month specified (YYYY-MM), filter orders by that month
  let orderIds: number[] | null = null;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const nextMonth = new Date(y, m, 1); // m is already 1-based, Date uses 0-based → gives next month
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .gte("order_date", `${month}-01`)
      .lt("order_date", nextMonthStr);
    orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length === 0) return [];
  }

  let query = supabase
    .from("order_items")
    .select("sales_rep, quantity, unit_price, purchase_price, order_id");

  if (orderIds) {
    query = query.in("order_id", orderIds);
  }

  const { data: items } = await query;

  if (!items?.length) return [];

  const map = new Map<string, { orderIds: Set<number>; revenue: number; purchase: number }>();
  for (const item of items) {
    const rep = item.sales_rep || "미배정";
    if (!map.has(rep)) map.set(rep, { orderIds: new Set(), revenue: 0, purchase: 0 });
    const entry = map.get(rep)!;
    entry.orderIds.add(item.order_id);
    entry.revenue += (item.unit_price ?? 0) * item.quantity;
    entry.purchase += (item.purchase_price ?? 0) * item.quantity;
  }

  return Array.from(map, ([rep, entry]) => ({
    sales_rep: rep,
    order_count: entry.orderIds.size,
    revenue: entry.revenue,
    purchase: entry.purchase,
    profit: entry.revenue - entry.purchase,
    margin: entry.revenue > 0 ? ((entry.revenue - entry.purchase) / entry.revenue) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

// ─── 4. 최근 주문 (with 금액) ───

export interface RecentOrder {
  id: number;
  order_number: string;
  order_date: string;
  hospital_name: string;
  status: string;
  supply_amount: number;
  total_amount: number;
}

export async function getRecentOrders(limit = 10): Promise<RecentOrder[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, order_date, status, supply_amount, total_amount, hospitals(name)")
    .order("order_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    order_date: o.order_date,
    hospital_name: (o.hospitals as unknown as { name: string } | null)?.name ?? "",
    status: o.status,
    supply_amount: Number(o.supply_amount || 0),
    total_amount: Number(o.total_amount || 0),
  }));
}

// ─── 5. 최근 세금계산서 ───

export interface RecentInvoice {
  id: number;
  invoice_number: string;
  issue_date: string;
  buyer_name: string;
  status: string;
  total_amount: number;
}

export async function getRecentInvoices(limit = 5): Promise<RecentInvoice[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_invoices")
    .select("id, invoice_number, issue_date, buyer_name, status, total_amount")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RecentInvoice[];
}
