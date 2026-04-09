"use server";

import { confirmOrder, updateOrderStatus } from "@/lib/queries/orders";
import { deleteOrders, updateOrder, updateOrderItem, deleteOrderItem, upsertKpisReport, createOrderComment, deleteOrderComment } from "@/lib/actions";
import { getOrgId } from "@/lib/org-context";
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
  data: { quantity?: number; unit_price?: number; purchase_price?: number; product_id?: number; supplier_id?: number | null; sales_rep?: string },
) {
  // products_catalog view uses negative IDs for my_drugs/my_devices entries
  if (data.product_id !== undefined && data.product_id <= 0) {
    data.product_id = undefined;
  }
  await updateOrderItem(itemId, data);
}

export async function deleteOrderItemAction(itemId: number) {
  await deleteOrderItem(itemId);
  revalidatePath("/orders");
}

export async function addOrderItemAction(data: {
  order_id: number;
  product_id: number | null;
  product_name: string;
  supplier_id: number | null;
  quantity: number;
  unit_type: string;
  unit_price: number | null;
  purchase_price: number | null;
  sales_rep: string | null;
}) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const organization_id = await getOrgId();
  // products_catalog view uses negative IDs for my_drugs/my_devices entries
  // These don't exist in the products table, so null out the FK reference
  const productId = data.product_id && data.product_id > 0 ? data.product_id : null;
  const { error } = await supabase.from("order_items").insert({
    ...data,
    product_id: productId,
    line_total: data.unit_price ? data.unit_price * data.quantity : null,
    organization_id,
  });
  if (error) throw error;
  revalidatePath("/orders");
  return { success: true };
}

export async function updateOrderTotalsAction(
  orderId: number,
  data: { supply_amount?: number; tax_amount?: number; total_amount?: number },
) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(data).eq("id", orderId);
  if (error) throw error;
  revalidatePath("/orders");
  return { success: true };
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
  const { searchHospitalsRpc } = await import("@/lib/queries/hospitals");
  const results = await searchHospitalsRpc(query, 20);
  return results.map((h) => ({ id: h.id, name: h.name, contact_person: h.contact_person ?? null }));
}

export async function searchSuppliersAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchSuppliersRpc } = await import("@/lib/queries/suppliers");
  const results = await searchSuppliersRpc(query, 20);
  return results.map((s) => ({ id: s.id, name: s.name }));
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
  const organization_id = await getOrgId();

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
      status: "delivered",
      total_items: data.items.length,
      organization_id,
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
      organization_id,
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
    product_name: string;
    source_type: "drug" | "device" | "product";
    supplier_id: number | null;
    quantity: number;
    unit_type: string;
    purchase_price: number | null;
    unit_price: number | null;
    kpis_reference_number: string | null;
    sales_rep: string | null;
    box_spec_id?: number | null;
  }>;
}) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const organization_id = await getOrgId();

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
      status: "delivered",
      total_items: data.items.length,
      total_amount: totalAmount || null,
      organization_id,
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  if (data.items.length > 0) {
    // product_id FK references products table only — validate before insert
    const productIds = data.items
      .filter((i) => i.source_type === "product" && i.product_id)
      .map((i) => i.product_id);
    const validProductIds = new Set<number>();
    if (productIds.length > 0) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .in("id", productIds);
      for (const p of existing ?? []) validProductIds.add(p.id);
    }

    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      product_id: item.source_type === "product" && validProductIds.has(item.product_id) ? item.product_id : null,
      product_name: item.product_name,
      supplier_id: item.supplier_id,
      box_spec_id: item.box_spec_id ?? null,
      quantity: item.quantity,
      unit_type: item.unit_type,
      unit_price: item.unit_price,
      purchase_price: item.purchase_price,
      line_total: item.unit_price ? item.unit_price * item.quantity : null,
      sales_rep: item.sales_rep,
      organization_id,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems)
      .select("id");
    if (itemsErr) throw itemsErr;

    const kpisInserts: Array<{ order_item_id: number; reference_number: string; report_status: string; organization_id: string }> = [];
    for (let i = 0; i < data.items.length; i++) {
      const ref = data.items[i].kpis_reference_number;
      if (ref && insertedItems?.[i]) {
        kpisInserts.push({ order_item_id: insertedItems[i].id, reference_number: ref, report_status: "pending", organization_id });
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

export async function getRecentHospitalsAction() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("hospital_id, hospitals!inner(id, name, contact_person)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  const seen = new Set<number>();
  const result: Array<{ id: number; name: string; contact_person: string | null }> = [];
  for (const row of data ?? []) {
    const h = row.hospitals as unknown as { id: number; name: string; contact_person: string | null };
    if (!seen.has(h.id)) {
      seen.add(h.id);
      result.push({ id: h.id, name: h.name, contact_person: h.contact_person ?? null });
      if (result.length >= 10) break;
    }
  }
  return result;
}

export async function getRecentPartnerProductsAction(hospitalId: number) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name, product_id, order_id, orders!inner(hospital_id)")
    .eq("orders.hospital_id", hospitalId)
    .not("product_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const seen = new Set<string>();
  const result: Array<{ id: number; product_source: "product"; product_id: number; name: string; code: string; unit_price: number | null }> = [];
  for (const row of data ?? []) {
    const key = `${row.product_id ?? row.product_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        id: 0,
        product_source: "product",
        product_id: row.product_id ?? 0,
        name: row.product_name ?? "",
        code: "",
        unit_price: null,
      });
      if (result.length >= 10) break;
    }
  }
  return result;
}

export async function searchMfdsItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: drugData } = await supabase.rpc("search_mfds_items", {
    query: query.trim(),
    source_type: "drug",
    result_limit: 30,
    page_num: 1,
    page_size: 30,
  });

  return (drugData ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as number, name: d.name as string, code: (d.code as string) ?? "",
    source_type: "drug" as const, manufacturer: d.manufacturer as string,
  }));
}

export async function getRecentMfdsItemsAction() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name")
    .is("product_id", null)
    .not("product_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const seen = new Set<string>();
  const result: Array<{ id: number; name: string; code: string; source_type: "drug" | "device_std" }> = [];
  for (const row of data ?? []) {
    if (row.product_name && !seen.has(row.product_name)) {
      seen.add(row.product_name);
      // Note: source_type is unknown from order_items alone; default to "drug".
      // This is acceptable since recent items are just a convenience shortcut.
      result.push({ id: 0, name: row.product_name, code: "", source_type: "drug" });
      if (result.length >= 10) break;
    }
  }
  return result;
}
