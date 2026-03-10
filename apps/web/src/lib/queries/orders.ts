import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, OrderDetail, OrderItem, OrderItemFlat } from "@/lib/types";

export async function getOrders(params: {
  status?: string;
  hospital_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ orders: Order[]; total: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from("orders")
    .select("*, hospitals(name)", { count: "exact" });

  if (params.status) query = query.eq("status", params.status);
  if (params.hospital_id) query = query.eq("hospital_id", params.hospital_id);
  if (params.from) query = query.gte("order_date", params.from);
  if (params.to) query = query.lte("order_date", params.to);

  query = query
    .order("created_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 25) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const orders: Order[] = (data ?? []).map((row) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
  }));

  return { orders, total: count ?? 0 };
}

export async function getOrderItems(params: {
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: OrderItemFlat[]; total: number }> {
  const supabase = createAdminClient();

  // Supabase PostgREST: select from order_items with nested joins
  const selectStr = [
    "id",
    "order_id",
    "mfds_item_id",
    "supplier_id",
    "quantity",
    "unit_price",
    "purchase_price",
    "discount_rate",
    "final_price",
    "display_columns",
    "line_total",
    "orders!inner(order_number, order_date, delivery_date, status, hospital_id, hospitals(name))",
    "mfds_items(item_name, manufacturer, source_type)",
    "suppliers(name)",
    "kpis_reports(report_status, notes)",
  ].join(",");

  let query = supabase
    .from("order_items")
    .select(selectStr, { count: "exact" });

  if (params.status) query = query.eq("orders.status", params.status);
  if (params.from) query = query.gte("orders.order_date", params.from);
  if (params.to) query = query.lte("orders.order_date", params.to);

  query = query
    .order("order_id", { ascending: false })
    .order("id", { ascending: true })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 25) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: OrderItemFlat[] = (data ?? []).map((row: any) => {
    const order = row.orders;
    const mfdsItem = row.mfds_items;
    const supplier = row.suppliers;
    const kpis = Array.isArray(row.kpis_reports) ? row.kpis_reports[0] : row.kpis_reports;

    return {
      id: row.id,
      order_id: row.order_id,
      order_number: order?.order_number ?? "",
      order_date: order?.order_date ?? "",
      delivery_date: order?.delivery_date ?? null,
      hospital_id: order?.hospital_id ?? null,
      hospital_name: order?.hospitals?.name ?? "",
      mfds_item_id: row.mfds_item_id ?? null,
      item_name: mfdsItem?.item_name ?? null,
      quantity: row.quantity,
      unit_price: row.unit_price ?? null,
      purchase_price: row.purchase_price ?? null,
      discount_rate: row.discount_rate ?? 0,
      final_price: row.final_price ?? null,
      display_columns: row.display_columns ?? null,
      line_total: row.line_total ?? null,
      supplier_id: row.supplier_id ?? null,
      supplier_name: supplier?.name ?? null,
      kpis_status: kpis?.report_status ?? null,
      kpis_notes: kpis?.notes ?? null,
      status: order?.status ?? "",
    };
  });

  return { items, total: count ?? 0 };
}

export async function getOrder(id: number): Promise<OrderDetail> {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, hospitals(name)")
    .eq("id", id)
    .single();

  if (error) throw error;

  const { data: items } = await supabase
    .from("order_items")
    .select("*, mfds_items(item_name, manufacturer, source_type), suppliers(name)")
    .eq("order_id", id)
    .order("id");

  return {
    ...order,
    hospital_name: (order.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
    items: (items ?? []) as OrderItem[],
  };
}

export async function confirmOrder(id: number) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function updateOrderStatus(id: number, status: string) {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "delivered") updates.delivered_at = new Date().toISOString();
  const { error } = await supabase.from("orders").update(updates).eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function generateOrderNumber(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("generate_order_number");
  if (error) throw error;
  return data as string;
}

/**
 * Get all orders in a date range (no pagination) for calendar view.
 */
export async function getOrdersForCalendar(params: {
  from: string;  // ISO date string "YYYY-MM-DD"
  to: string;    // ISO date string "YYYY-MM-DD"
}): Promise<Order[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, hospitals(name)")
    .gte("order_date", params.from)
    .lt("order_date", params.to)
    .order("order_date", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
  })) as Order[];
}
