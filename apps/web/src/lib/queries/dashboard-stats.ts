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
    .select("id, status")
    .gte("order_date", thisMonthStart)
    .lt("order_date", nextMonthStart);

  const orders = thisMonthOrders ?? [];

  // Current month items for revenue + purchase calc (source of truth)
  const orderIds = orders.map((o) => o.id);
  let monthlyRevenue = 0;
  let monthlyPurchase = 0;
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, unit_price, purchase_price")
      .in("order_id", orderIds);
    for (const i of items ?? []) {
      monthlyRevenue += Math.round((Number(i.unit_price ?? 0)) * 1.1) * (i.quantity ?? 0);
      monthlyPurchase += Math.round((Number(i.purchase_price ?? 0)) * 1.1) * (i.quantity ?? 0);
    }
  }

  const monthlyProfit = monthlyRevenue - monthlyPurchase;

  // Previous month revenue (also from order_items)
  const { data: prevOrders } = await supabase
    .from("orders")
    .select("id")
    .gte("order_date", prevMonthStart)
    .lt("order_date", thisMonthStart);

  let prevMonthRevenue = 0;
  const prevOrderIds = (prevOrders ?? []).map((o) => o.id);
  if (prevOrderIds.length > 0) {
    const { data: prevItems } = await supabase
      .from("order_items")
      .select("quantity, unit_price")
      .in("order_id", prevOrderIds);
    prevMonthRevenue = (prevItems ?? []).reduce((s, i) => s + Math.round((Number(i.unit_price ?? 0)) * 1.1) * (i.quantity ?? 0), 0);
  }
  const revenueGrowth = prevMonthRevenue > 0 ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  // Order status counts (this month only)
  const statusCounts: Record<string, number> = {};
  for (const o of orders) {
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

// ─── 1b. 연간 KPI ───

export interface YearlyKpis {
  year: number;
  revenue: number;
  purchase: number;
  profit: number;
  profitMargin: number;
  orderCount: number;
  invoicesIssued: number;
  unbilledOrders: number;
  prevYearRevenue: number;
  revenueGrowth: number;
}

export async function getYearlyKpis(year?: number): Promise<YearlyKpis> {
  const supabase = await createClient();
  const y = year ?? new Date().getFullYear();
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y + 1}-01-01`;
  const prevYearStart = `${y - 1}-01-01`;

  // This year orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status")
    .gte("order_date", yearStart)
    .lt("order_date", yearEnd);

  const rows = orders ?? [];
  const orderIds = rows.map((o) => o.id);

  // Revenue + purchase from order_items (source of truth)
  let revenue = 0;
  let purchase = 0;
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, unit_price, purchase_price")
      .in("order_id", orderIds);
    for (const i of items ?? []) {
      revenue += Math.round((Number(i.unit_price ?? 0)) * 1.1) * (i.quantity ?? 0);
      purchase += Math.round((Number(i.purchase_price ?? 0)) * 1.1) * (i.quantity ?? 0);
    }
  }

  // Prev year revenue (also from order_items)
  const { data: prevOrders } = await supabase
    .from("orders")
    .select("id")
    .gte("order_date", prevYearStart)
    .lt("order_date", yearStart);
  let prevYearRevenue = 0;
  const prevOrderIds = (prevOrders ?? []).map((o) => o.id);
  if (prevOrderIds.length > 0) {
    const { data: prevItems } = await supabase
      .from("order_items")
      .select("quantity, unit_price")
      .in("order_id", prevOrderIds);
    prevYearRevenue = (prevItems ?? []).reduce((s, i) => s + Math.round((Number(i.unit_price ?? 0)) * 1.1) * (i.quantity ?? 0), 0);
  }

  // Status counts & invoices
  const statusCounts: Record<string, number> = {};
  for (const o of rows) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

  const { data: invoices } = await supabase
    .from("tax_invoices")
    .select("status")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd);
  const invoicesIssued = (invoices ?? []).filter((i) => i.status === "issued" || i.status === "sent").length;

  const profit = revenue - purchase;

  return {
    year: y,
    revenue,
    purchase,
    profit,
    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
    orderCount: rows.length,
    invoicesIssued,
    unbilledOrders: statusCounts.delivered ?? 0,
    prevYearRevenue,
    revenueGrowth: prevYearRevenue > 0 ? ((revenue - prevYearRevenue) / prevYearRevenue) * 100 : 0,
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

export async function getHospitalRanking(limit = 10, month?: string): Promise<HospitalRanking[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, hospital_id, hospitals(name)")
    .not("status", "eq", "cancelled");

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const nextMonth = new Date(y, m, 1);
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
    query = query.gte("order_date", `${month}-01`).lt("order_date", nextMonthStr);
  }

  const { data: orders } = await query;

  if (!orders?.length) return [];

  // Group by hospital
  const map = new Map<number, { name: string; orderIds: number[] }>();
  for (const o of orders) {
    const hid = o.hospital_id;
    const name = (o.hospitals as unknown as { name: string } | null)?.name ?? "";
    if (!map.has(hid)) map.set(hid, { name, orderIds: [] });
    map.get(hid)!.orderIds.push(o.id);
  }

  // Get revenue + purchase from order_items (source of truth)
  const allOrderIds = orders.map((o) => o.id);
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, quantity, unit_price, purchase_price")
    .in("order_id", allOrderIds);

  const revenueByOrder = new Map<number, number>();
  const purchaseByOrder = new Map<number, number>();
  for (const item of items ?? []) {
    revenueByOrder.set(item.order_id, (revenueByOrder.get(item.order_id) || 0) + Math.round(Number(item.unit_price ?? 0) * 1.1) * (item.quantity ?? 0));
    purchaseByOrder.set(item.order_id, (purchaseByOrder.get(item.order_id) || 0) + Math.round(Number(item.purchase_price ?? 0) * 1.1) * (item.quantity ?? 0));
  }

  const result: HospitalRanking[] = [];
  for (const [hid, entry] of map) {
    const revenue = entry.orderIds.reduce((s, id) => s + (revenueByOrder.get(id) || 0), 0);
    const purchase = entry.orderIds.reduce((s, id) => s + (purchaseByOrder.get(id) || 0), 0);
    const profit = revenue - purchase;
    result.push({
      hospital_id: hid,
      hospital_name: entry.name,
      order_count: entry.orderIds.length,
      revenue,
      purchase,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
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
    .select("id, order_number, order_date, status, total_amount, hospitals(name)")
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
    supply_amount: Number(o.total_amount || 0),
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
