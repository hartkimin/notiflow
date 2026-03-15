import { createClient } from "@/lib/supabase/server";
import type { Order, OrderDetail, OrderItem, OrderItemFlat } from "@/lib/types";

export async function getOrders(params: {
  status?: string;
  hospital_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ orders: Order[]; total: number }> {
  const supabase = await createClient();

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
  const supabase = await createClient();

  // Supabase PostgREST: select from order_items with nested joins
  const selectStr = [
    "id",
    "order_id",
    "product_id",
    "supplier_id",
    "quantity",
    "unit_type",
    "box_spec_id",
    "calculated_pieces",
    "orders!inner(order_number, order_date, delivery_date, status, hospital_id, hospitals(name))",
    "products(official_name, short_name)",
    "suppliers(name)",
    "product_box_specs(qty_per_box)",
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
    const product = row.products;
    const supplier = row.suppliers;
    const boxSpec = row.product_box_specs;
    const kpis = Array.isArray(row.kpis_reports) ? row.kpis_reports[0] : row.kpis_reports;

    // Calculate box quantity: if box_spec exists use its qty_per_box, else null
    const qtyPerBox = boxSpec?.qty_per_box ?? null;
    let boxQuantity: number | null = null;
    if (qtyPerBox && qtyPerBox > 0) {
      if (row.unit_type === "box") {
        boxQuantity = row.quantity;
      } else {
        boxQuantity = Math.floor(row.quantity / qtyPerBox);
      }
    }

    return {
      id: row.id,
      order_id: row.order_id,
      order_number: order?.order_number ?? "",
      order_date: order?.order_date ?? "",
      delivery_date: order?.delivery_date ?? null,
      hospital_id: order?.hospital_id ?? null,
      hospital_name: order?.hospitals?.name ?? "",
      product_id: row.product_id ?? null,
      product_name: product?.official_name ?? product?.short_name ?? row.product_name ?? "",
      quantity: row.unit_type === "box" && qtyPerBox
        ? row.quantity * qtyPerBox
        : row.calculated_pieces ?? row.quantity,
      unit_type: row.unit_type,
      box_quantity: boxQuantity,
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
  const supabase = await createClient();

  const [{ data: order, error }, { data: items }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, hospitals(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("order_items")
      .select("*, products(name, official_name), suppliers(name)")
      .eq("order_id", id)
      .order("id"),
  ]);

  if (error) throw error;

  return {
    ...order,
    hospital_name: (order.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
    items: (items ?? []) as OrderItem[],
  };
}

export async function confirmOrder(id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function updateOrderStatus(id: number, status: string) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === "delivered") updates.delivered_at = new Date().toISOString();
  const { error } = await supabase.from("orders").update(updates).eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function generateOrderNumber(): Promise<string> {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
