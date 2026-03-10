import { createAdminClient } from "@/lib/supabase/admin";
import type { HospitalItemWithPricing } from "@/lib/types";

export async function getHospitalItems(
  hospitalId: number,
): Promise<{ items: HospitalItemWithPricing[]; defaultMarginRate: number }> {
  const supabase = createAdminClient();

  // 1. Get hospital default_margin_rate
  const { data: hospital, error: hErr } = await supabase
    .from("hospitals")
    .select("default_margin_rate")
    .eq("id", hospitalId)
    .single();
  if (hErr) throw hErr;

  const defaultMarginRate: number = (hospital.default_margin_rate as number) ?? 0;

  // 2. Get hospital_items with mfds_items JOIN
  const { data: rows, error: iErr } = await supabase
    .from("hospital_items")
    .select(
      "id, hospital_id, mfds_item_id, delivery_price, notes, created_at, mfds_items(item_name, manufacturer, source_type, standard_code)",
    )
    .eq("hospital_id", hospitalId)
    .order("created_at", { ascending: false });

  if (iErr) throw iErr;

  const itemRows = rows ?? [];
  if (itemRows.length === 0) {
    return { items: [], defaultMarginRate };
  }

  // 3. Get primary supplier prices for these mfds_item_ids
  const mfdsItemIds = itemRows.map((r) => (r as Record<string, unknown>).mfds_item_id as number);
  const { data: supplierPrices, error: spErr } = await supabase
    .from("supplier_items")
    .select("mfds_item_id, purchase_price")
    .eq("is_primary", true)
    .in("mfds_item_id", mfdsItemIds);

  if (spErr) throw spErr;

  const priceMap = new Map<number, number | null>();
  for (const sp of supplierPrices ?? []) {
    priceMap.set(sp.mfds_item_id as number, sp.purchase_price as number | null);
  }

  // 4. Build HospitalItemWithPricing list
  const items: HospitalItemWithPricing[] = itemRows.map((row: Record<string, unknown>) => {
    const mfds = row.mfds_items as Record<string, unknown> | null;
    const mfdsItemId = row.mfds_item_id as number;
    const deliveryPrice = row.delivery_price as number | null;
    const primaryPurchasePrice = priceMap.get(mfdsItemId) ?? null;

    // Compute delivery price: purchase_price * (1 + margin_rate/100)
    let computedDeliveryPrice: number | null = null;
    if (primaryPurchasePrice != null) {
      computedDeliveryPrice = Math.round(
        primaryPurchasePrice * (1 + defaultMarginRate / 100),
      );
    }

    return {
      id: row.id as number,
      hospital_id: row.hospital_id as number,
      mfds_item_id: mfdsItemId,
      delivery_price: deliveryPrice,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      item_name: (mfds?.item_name as string) ?? undefined,
      manufacturer: (mfds?.manufacturer as string) ?? undefined,
      source_type: (mfds?.source_type as string) ?? undefined,
      standard_code: (mfds?.standard_code as string) ?? undefined,
      primary_purchase_price: primaryPurchasePrice,
      default_margin_rate: defaultMarginRate,
      computed_delivery_price: computedDeliveryPrice,
    };
  });

  return { items, defaultMarginRate };
}

export async function getHospitalItemIds(hospitalId: number): Promise<number[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hospital_items")
    .select("mfds_item_id")
    .eq("hospital_id", hospitalId);

  if (error) throw error;
  return (data ?? []).map((row) => row.mfds_item_id as number);
}
