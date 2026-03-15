import { createClient } from "@/lib/supabase/server";
import type { HospitalProduct, ProductSupplierOption } from "@/lib/types";

/**
 * Get products registered to a hospital with their supplier info.
 */
export async function getHospitalProducts(
  hospitalId: number,
): Promise<HospitalProduct[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("hospital_products")
    .select(
      "id, hospital_id, product_id, selling_price, default_quantity, products(name, official_name, short_name, manufacturer, standard_code)",
    )
    .eq("hospital_id", hospitalId)
    .order("id");

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productIds = (data ?? []).map((d: any) => d.product_id as number).filter(Boolean);

  let supplierMap: Record<number, ProductSupplierOption[]> = {};
  if (productIds.length > 0) {
    const { data: ps } = await supabase
      .from("product_suppliers")
      .select("product_id, supplier_id, purchase_price, is_primary, suppliers(name)")
      .in("product_id", productIds);

    supplierMap = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (ps ?? []) as any[]) {
      const pid = row.product_id as number;
      if (!supplierMap[pid]) supplierMap[pid] = [];
      supplierMap[pid].push({
        supplier_id: row.supplier_id as number,
        supplier_name: (row.suppliers as { name: string } | null)?.name ?? "",
        purchase_price: row.purchase_price as number | null,
        is_primary: row.is_primary as boolean,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
    const product = row.products as {
      name: string; official_name: string; short_name: string | null;
      manufacturer: string | null; standard_code: string | null;
    } | null;
    const pid = row.product_id as number;
    return {
      id: row.id as number,
      hospital_id: row.hospital_id as number,
      product_id: pid,
      product_name: product?.official_name ?? product?.short_name ?? product?.name ?? "",
      manufacturer: product?.manufacturer ?? null,
      standard_code: product?.standard_code ?? null,
      selling_price: row.selling_price as number | null,
      default_quantity: row.default_quantity as number | null,
      suppliers: supplierMap[pid] ?? [],
    };
  });
}

/**
 * Get all suppliers carrying a specific product.
 */
export async function getProductSuppliers(
  productId: number,
): Promise<ProductSupplierOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_suppliers")
    .select("supplier_id, purchase_price, is_primary, suppliers(name)")
    .eq("product_id", productId);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    supplier_id: row.supplier_id as number,
    supplier_name: (row.suppliers as { name: string } | null)?.name ?? "",
    purchase_price: row.purchase_price as number | null,
    is_primary: row.is_primary as boolean,
  }));
}
