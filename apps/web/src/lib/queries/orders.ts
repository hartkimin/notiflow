import { createClient } from "@/lib/supabase/server";
import type { Order, OrderDetail, OrderItem } from "@/lib/types";

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

export async function getOrder(id: number): Promise<OrderDetail> {
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, hospitals(name)")
    .eq("id", id)
    .single();

  if (error) throw error;

  const { data: items } = await supabase
    .from("order_items")
    .select("*, products(name, official_name), suppliers(name)")
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
