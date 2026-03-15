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
  source_message_id?: string | null;
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

// --- Hospital Products & PO Actions ---

export async function getAllHospitalsAction() {
  const { getHospitals } = await import("@/lib/queries/hospitals");
  const { hospitals } = await getHospitals({ limit: 200 });
  return hospitals.map((h) => ({ id: h.id, name: h.name }));
}

export async function getAllProductsAction() {
  const { getProductsCatalog } = await import("@/lib/queries/products");
  const catalog = await getProductsCatalog();
  return catalog.map((p) => ({
    id: p.id,
    name: p.name,
    official_name: p.official_name,
    manufacturer: null as string | null,
    standard_code: p.standard_code ?? null,
  }));
}

export async function getHospitalProductsAction(hospitalId: number) {
  const { getHospitalProducts } = await import("@/lib/queries/hospital-products");
  return getHospitalProducts(hospitalId);
}

export async function getPartnerProductsForOrderAction(hospitalId: number) {
  const { getPartnerProducts } = await import("@/lib/actions");
  return getPartnerProducts("hospital", hospitalId);
}

export async function getProductSuppliersAction(productId: number) {
  const { getProductSuppliers } = await import("@/lib/queries/hospital-products");
  return getProductSuppliers(productId);
}

export async function createOrderWithDetailsAction(data: {
  hospital_id: number;
  order_date: string;
  delivery_date: string | null;
  delivered_at: string | null;
  notes: string | null;
  source_message_id: string | null;
  items: Array<{
    product_id: number;
    supplier_id: number | null;
    quantity: number;
    unit_type: string;
    purchase_price: number | null;
    unit_price: number | null;
    kpis_reference_number: string | null;
  }>;
}) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: orderNumber, error: rpcErr } = await supabase.rpc("generate_order_number");
  if (rpcErr) throw rpcErr;

  const totalAmount = data.items.reduce((sum, item) => sum + (item.unit_price ?? 0) * item.quantity, 0);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: data.order_date,
      hospital_id: data.hospital_id,
      delivery_date: data.delivery_date,
      delivered_at: data.delivered_at,
      notes: data.notes,
      source_message_id: data.source_message_id,
      status: "draft",
      total_items: data.items.length,
      total_amount: totalAmount || null,
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  if (data.items.length > 0) {
    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      supplier_id: item.supplier_id,
      quantity: item.quantity,
      unit_type: item.unit_type,
      unit_price: item.unit_price,
      purchase_price: item.purchase_price,
      line_total: item.unit_price ? item.unit_price * item.quantity : null,
      match_status: "manual" as const,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems)
      .select("id");
    if (itemsErr) throw itemsErr;

    const kpisInserts: Array<{ order_item_id: number; reference_number: string; report_status: string }> = [];
    for (let i = 0; i < data.items.length; i++) {
      const ref = data.items[i].kpis_reference_number;
      if (ref && insertedItems?.[i]) {
        kpisInserts.push({ order_item_id: insertedItems[i].id, reference_number: ref, report_status: "pending" });
      }
    }
    if (kpisInserts.length > 0) {
      const { error: kpisErr } = await supabase.from("kpis_reports").insert(kpisInserts);
      if (kpisErr) throw kpisErr;
    }
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true, orderId: order.id, orderNumber };
}
