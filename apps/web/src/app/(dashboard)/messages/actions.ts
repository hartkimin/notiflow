"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ManualParseItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export async function createManualOrder(
  messageId: number,
  hospitalId: number,
  items: ManualParseItem[],
) {
  const supabase = await createClient();

  // Generate order number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("order_date", new Date().toISOString().slice(0, 10));
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  const orderNumber = `ORD-${today}-${seq}`;

  // Calculate totals
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const supplyAmount = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmount = Math.round(supplyAmount * 0.1);

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: new Date().toISOString().slice(0, 10),
      hospital_id: hospitalId,
      message_id: messageId,
      status: "draft",
      total_items: totalItems,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: supplyAmount + taxAmount,
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  // Create order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.quantity * item.unit_price,
    match_status: "manual" as const,
    match_confidence: 1.0,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) throw itemsError;

  // Update message status
  await supabase
    .from("raw_messages")
    .update({
      parse_status: "parsed",
      parse_method: "manual",
      order_id: order.id,
    })
    .eq("id", messageId);

  revalidatePath("/messages");
  revalidatePath("/orders");
  revalidatePath("/");

  return { orderId: order.id, orderNumber };
}
