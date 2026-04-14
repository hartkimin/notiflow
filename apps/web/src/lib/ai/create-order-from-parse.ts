import { createAdminClient } from "@/lib/supabase/admin";
import type { MatchedItem } from "./match-products";

export interface CreateOrderResult {
  orderId: number;
  orderNumber: string;
  itemCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

export async function createOrderFromParsedItems(
  hospitalId: number,
  sourceMessageId: string,
  items: MatchedItem[],
): Promise<CreateOrderResult> {
  const supabase = createAdminClient();

  // Resolve org from the hospital (AI parsing runs as admin, not as a specific user)
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("organization_id")
    .eq("id", hospitalId)
    .single();
  const organization_id = hospital?.organization_id as string | undefined;

  const { data: orderNumber, error: rpcErr } = await supabase.rpc("generate_order_number");
  if (rpcErr) throw rpcErr;

  const today = new Date().toISOString().slice(0, 10);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: today,
      hospital_id: hospitalId,
      source_message_id: sourceMessageId,
      status: "draft",
      total_items: items.length,
      notes: `AI 자동 생성 (${items.filter(i => i.product_id).length}/${items.length} 품목 매칭)`,
      ...(organization_id ? { organization_id } : {}),
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  if (items.length > 0) {
    const orderItems = items.map(item => ({
      order_id: order.id,
      // product_id FK only works for products table — set null for mfds/my items
      product_id: null,
      product_name: item.product_name_matched ?? item.matched_product ?? item.item,
      quantity: item.qty,
      unit_type: item.unit,
      ...(organization_id ? { organization_id } : {}),
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;
  }

  return {
    orderId: order.id,
    orderNumber,
    itemCount: items.length,
    matchedCount: items.filter(i => i.product_id !== null).length,
    unmatchedCount: items.filter(i => i.product_id === null).length,
  };
}
