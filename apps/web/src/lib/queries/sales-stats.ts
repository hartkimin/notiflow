import { createClient } from "@/lib/supabase/server";

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(y, m, 1);
  return {
    start: `${month}-01`,
    end: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`,
  };
}

// ─── Sales Rep Detail ───

export interface SalesRepDetail {
  sales_rep: string;
  order_count: number;
  item_count: number;
  revenue: number;
  purchase: number;
  profit: number;
  margin: number;
}

export async function getSalesRepDetail(month: string): Promise<SalesRepDetail[]> {
  const supabase = await createClient();
  const { start, end } = monthRange(month);

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .gte("order_date", start)
    .lt("order_date", end)
    .not("status", "eq", "cancelled");

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, sales_rep, quantity, unit_price, purchase_price")
    .in("order_id", orderIds);

  const map = new Map<string, { orderIds: Set<number>; itemCount: number; revenue: number; purchase: number }>();
  for (const item of items ?? []) {
    const rep = item.sales_rep || "미배정";
    if (!map.has(rep)) map.set(rep, { orderIds: new Set(), itemCount: 0, revenue: 0, purchase: 0 });
    const entry = map.get(rep)!;
    entry.orderIds.add(item.order_id);
    entry.itemCount++;
    entry.revenue += (item.unit_price ?? 0) * item.quantity;
    entry.purchase += (item.purchase_price ?? 0) * item.quantity;
  }

  return Array.from(map, ([rep, e]) => ({
    sales_rep: rep,
    order_count: e.orderIds.size,
    item_count: e.itemCount,
    revenue: e.revenue,
    purchase: e.purchase,
    profit: e.revenue - e.purchase,
    margin: e.revenue > 0 ? ((e.revenue - e.purchase) / e.revenue) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

// ─── Hospital Detail ───

export interface HospitalDetail {
  hospital_id: number;
  hospital_name: string;
  sales_rep: string;
  order_count: number;
  item_count: number;
  revenue: number;
  purchase: number;
  profit: number;
  margin: number;
}

export async function getHospitalDetail(month: string): Promise<HospitalDetail[]> {
  const supabase = await createClient();
  const { start, end } = monthRange(month);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, hospital_id, hospitals(name)")
    .gte("order_date", start)
    .lt("order_date", end)
    .not("status", "eq", "cancelled");

  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);
  const hospitalMap = new Map<number, string>();
  for (const o of orders) {
    if (!hospitalMap.has(o.hospital_id)) {
      hospitalMap.set(o.hospital_id, (o.hospitals as unknown as { name: string } | null)?.name ?? "");
    }
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, sales_rep, quantity, unit_price, purchase_price")
    .in("order_id", orderIds);

  // Map order_id → hospital_id
  const orderHospitalMap = new Map<number, number>();
  for (const o of orders) orderHospitalMap.set(o.id, o.hospital_id);

  const map = new Map<number, { reps: Set<string>; orderIds: Set<number>; itemCount: number; revenue: number; purchase: number }>();
  for (const item of items ?? []) {
    const hid = orderHospitalMap.get(item.order_id);
    if (!hid) continue;
    if (!map.has(hid)) map.set(hid, { reps: new Set(), orderIds: new Set(), itemCount: 0, revenue: 0, purchase: 0 });
    const entry = map.get(hid)!;
    entry.orderIds.add(item.order_id);
    if (item.sales_rep) entry.reps.add(item.sales_rep);
    entry.itemCount++;
    entry.revenue += (item.unit_price ?? 0) * item.quantity;
    entry.purchase += (item.purchase_price ?? 0) * item.quantity;
  }

  return Array.from(map, ([hid, e]) => ({
    hospital_id: hid,
    hospital_name: hospitalMap.get(hid) ?? "",
    sales_rep: [...e.reps].join(", ") || "미배정",
    order_count: e.orderIds.size,
    item_count: e.itemCount,
    revenue: e.revenue,
    purchase: e.purchase,
    profit: e.revenue - e.purchase,
    margin: e.revenue > 0 ? ((e.revenue - e.purchase) / e.revenue) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

// ─── Order Detail ───

export interface OrderDetailRow {
  id: number;
  order_number: string;
  order_date: string;
  hospital_name: string;
  status: string;
  item_count: number;
  purchase: number;
  revenue: number;
  profit: number;
  margin: number;
  sales_rep: string;
}

export async function getOrderDetail(month: string): Promise<OrderDetailRow[]> {
  const supabase = await createClient();
  const { start, end } = monthRange(month);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, order_date, status, hospital_id, supply_amount, hospitals(name)")
    .gte("order_date", start)
    .lt("order_date", end)
    .order("order_date", { ascending: false });

  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, sales_rep, quantity, unit_price, purchase_price")
    .in("order_id", orderIds);

  // Aggregate per order
  const itemMap = new Map<number, { reps: Set<string>; count: number; revenue: number; purchase: number }>();
  for (const item of items ?? []) {
    if (!itemMap.has(item.order_id)) itemMap.set(item.order_id, { reps: new Set(), count: 0, revenue: 0, purchase: 0 });
    const e = itemMap.get(item.order_id)!;
    e.count++;
    if (item.sales_rep) e.reps.add(item.sales_rep);
    e.revenue += (item.unit_price ?? 0) * item.quantity;
    e.purchase += (item.purchase_price ?? 0) * item.quantity;
  }

  return orders.map((o) => {
    const e = itemMap.get(o.id) || { reps: new Set(), count: 0, revenue: 0, purchase: 0 };
    const profit = e.revenue - e.purchase;
    return {
      id: o.id,
      order_number: o.order_number,
      order_date: o.order_date,
      hospital_name: (o.hospitals as unknown as { name: string } | null)?.name ?? "",
      status: o.status,
      item_count: e.count,
      purchase: e.purchase,
      revenue: e.revenue,
      profit,
      margin: e.revenue > 0 ? (profit / e.revenue) * 100 : 0,
      sales_rep: [...e.reps].join(", ") || "미배정",
    };
  });
}
