"use server";

import { confirmOrder, updateOrderStatus } from "@/lib/queries/orders";
import { deleteOrders, updateOrder, updateOrderItem, deleteOrderItem, upsertKpisReport, createOrderComment, deleteOrderComment } from "@/lib/actions";
import { revalidatePath } from "next/cache";

export async function confirmOrderAction(orderId: number) {
  await confirmOrder(orderId);
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function updateOrderStatusAction(orderId: number, status: string) {
  await updateOrderStatus(orderId, status);
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function deleteOrdersAction(ids: number[]) {
  await deleteOrders(ids);
}

export async function updateOrderItemAction(
  itemId: number,
  data: { quantity?: number; unit_price?: number; product_id?: number; supplier_id?: number | null },
) {
  await updateOrderItem(itemId, data);
}

export async function deleteOrderItemAction(itemId: number) {
  await deleteOrderItem(itemId);
  revalidatePath("/orders");
}

export async function updateDeliveryDateAction(
  orderId: number,
  date: string | null,
) {
  await updateOrder(orderId, { delivery_date: date });
}

export async function updateDeliveredAtAction(
  orderId: number,
  date: string | null,
) {
  await updateOrder(orderId, { delivered_at: date });
}

export async function updateOrderHospitalAction(
  orderId: number,
  hospitalId: number,
) {
  await updateOrder(orderId, { hospital_id: hospitalId });
  revalidatePath("/orders");
}

export async function upsertKpisReportAction(
  orderItemId: number,
  data: { report_status?: string; notes?: string },
) {
  await upsertKpisReport(orderItemId, data);
}

export async function createOrderCommentAction(orderId: number, content: string) {
  await createOrderComment(orderId, content);
}

export async function deleteOrderCommentAction(commentId: number, orderId: number) {
  await deleteOrderComment(commentId, orderId);
}

export async function searchMyItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchMyItems } = await import("@/lib/queries/products");
  return searchMyItems(query);
}

export async function searchHospitalsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { getHospitals } = await import("@/lib/queries/hospitals");
  const { hospitals } = await getHospitals({ search: query, limit: 20 });
  return hospitals.map((h) => ({ id: h.id, name: h.name }));
}

export async function searchSuppliersAction(query: string) {
  if (!query || query.length < 1) return [];
  const { getSuppliers } = await import("@/lib/queries/suppliers");
  const { suppliers } = await getSuppliers({ search: query, limit: 20 });
  return suppliers.map((s) => ({ id: s.id, name: s.name }));
}

export async function getCalendarOrdersAction(from: string, to: string) {
  const { getOrdersForCalendar } = await import("@/lib/queries/orders");
  return getOrdersForCalendar({ from, to });
}

export async function createOrderAction(data: {
  hospital_id: number;
  order_date: string;
  delivery_date?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
  items: Array<{
    my_item_id: number;
    my_item_type: "drug" | "device";
    quantity: number;
    unit_price: number | null;
  }>;
}) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Generate order number via DB function
  const { data: orderNumber, error: rpcErr } = await supabase.rpc("generate_order_number");
  if (rpcErr) throw rpcErr;

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: data.order_date,
      hospital_id: data.hospital_id,
      delivery_date: data.delivery_date ?? null,
      delivered_at: data.delivered_at ?? null,
      notes: data.notes ?? null,
      status: "draft",
      total_items: data.items.length,
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  // Insert order items
  if (data.items.length > 0) {
    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.unit_price ? item.unit_price * item.quantity : null,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true, orderId: order.id, orderNumber };
}
