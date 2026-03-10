import { createAdminClient } from "@/lib/supabase/admin";
import type { SupplierItem } from "@/lib/types";

export async function getSupplierItems(supplierId: number): Promise<SupplierItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_items")
    .select(
      "id, supplier_id, mfds_item_id, purchase_price, is_primary, notes, created_at, mfds_items(item_name, manufacturer, source_type, standard_code)",
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const mfds = row.mfds_items as Record<string, unknown> | null;
    return {
      id: row.id as number,
      supplier_id: row.supplier_id as number,
      mfds_item_id: row.mfds_item_id as number,
      purchase_price: row.purchase_price as number | null,
      is_primary: row.is_primary as boolean,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      item_name: (mfds?.item_name as string) ?? undefined,
      manufacturer: (mfds?.manufacturer as string) ?? undefined,
      source_type: (mfds?.source_type as string) ?? undefined,
      standard_code: (mfds?.standard_code as string) ?? undefined,
    };
  });
}

export async function getSupplierItemIds(supplierId: number): Promise<number[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_items")
    .select("mfds_item_id")
    .eq("supplier_id", supplierId);

  if (error) throw error;
  return (data ?? []).map((row) => row.mfds_item_id as number);
}
