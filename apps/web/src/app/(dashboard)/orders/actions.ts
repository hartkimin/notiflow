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
  data: {
    quantity?: number;
    unit_price?: number;
    mfds_item_id?: number;
    supplier_id?: number | null;
    purchase_price?: number | null;
    discount_rate?: number;
    final_price?: number | null;
  },
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
  discount_rate?: number;
  source_message_id?: string | null;
  items: Array<{
    mfds_item_id: number;
    supplier_id?: number | null;
    quantity: number;
    unit_price?: number | null;
    purchase_price?: number | null;
    discount_rate?: number;
    final_price?: number | null;
    display_columns?: Record<string, string> | null;
  }>;
}) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

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
      discount_rate: data.discount_rate ?? 0,
      source_message_id: data.source_message_id ?? null,
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
      mfds_item_id: item.mfds_item_id,
      supplier_id: item.supplier_id ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price ?? null,
      purchase_price: item.purchase_price ?? null,
      discount_rate: item.discount_rate ?? 0,
      final_price: item.final_price ?? null,
      display_columns: item.display_columns ?? null,
      line_total: item.final_price ? item.final_price * item.quantity : null,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true, orderId: order.id, orderNumber };
}

export async function getHospitalItemsForOrderAction(hospitalId: number) {
  const { getHospitalItems } = await import("@/lib/queries/hospital-items");
  return getHospitalItems(hospitalId);
}

export async function getSupplierItemsForProductAction(mfdsItemId: number) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("supplier_items")
    .select("supplier_id, purchase_price, is_primary, suppliers(name)")
    .eq("mfds_item_id", mfdsItemId);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    supplier_id: d.supplier_id as number,
    supplier_name: ((d.suppliers as Record<string, unknown>)?.name as string) ?? "",
    purchase_price: d.purchase_price as number | null,
    is_primary: d.is_primary as boolean,
  }));
}

export async function searchFavoriteItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchFavoriteItems } = await import("@/lib/actions");
  return searchFavoriteItems(query);
}
