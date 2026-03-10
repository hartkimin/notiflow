import { createAdminClient } from "@/lib/supabase/admin";

export async function getExistingStandardCodes(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mfds_items")
    .select("standard_code")
    .eq("is_favorite", true)
    .not("standard_code", "is", null);
  return (data ?? []).map((d) => d.standard_code).filter(Boolean) as string[];
}

export async function searchMyItems(query: string): Promise<Array<{
  id: number;
  type: "drug" | "device";
  name: string;
  code: string | null;
  manufacturer: string | null;
  unit_price: number | null;
  raw: Record<string, unknown>;
}>> {
  const supabase = createAdminClient();
  const q = `%${query}%`;

  const { data } = await supabase
    .from("mfds_items")
    .select("id, source_type, item_name, manufacturer, standard_code, unit_price, raw_data")
    .eq("is_favorite", true)
    .or(`item_name.ilike.${q},manufacturer.ilike.${q},standard_code.ilike.${q}`)
    .limit(40);

  return (data ?? []).map((d) => ({
    id: d.id as number,
    type: (d.source_type === "drug" ? "drug" : "device") as "drug" | "device",
    name: (d.item_name as string) ?? "",
    code: d.standard_code as string | null,
    manufacturer: d.manufacturer as string | null,
    unit_price: d.unit_price as number | null,
    raw: d.raw_data as Record<string, unknown>,
  }));
}

export async function getProductsCatalog() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mfds_items")
    .select("id, item_name, standard_code, source_type")
    .eq("is_favorite", true)
    .order("item_name");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id as number,
    name: (d.item_name as string) ?? "",
    official_name: (d.item_name as string) ?? "",
    short_name: null,
    is_active: true,
    standard_code: d.standard_code as string | null,
    source_type: (d.source_type as string) ?? "",
  }));
}
