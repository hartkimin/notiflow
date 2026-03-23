import { createClient } from "@/lib/supabase/server";
import type { MyDrug, MyDevice } from "@/lib/types";

export async function getMyDrugs(): Promise<MyDrug[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_drugs")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyDrug[];
}

export async function getMyDevices(): Promise<MyDevice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_devices")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyDevice[];
}

export async function getExistingStandardCodes(): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("bar_code"),
    supabase.from("my_devices").select("udidi_cd"),
  ]);
  const codes: string[] = [];
  for (const d of drugs ?? []) if (d.bar_code) codes.push(d.bar_code);
  for (const d of devices ?? []) if (d.udidi_cd) codes.push(d.udidi_cd);
  return codes;
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
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_my_items", {
    query,
    source_type: "all",
    result_limit: 30,
  });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    type: row.item_type as "drug" | "device",
    name: (row.name as string) ?? "",
    code: (row.code as string) ?? null,
    manufacturer: (row.manufacturer as string) ?? null,
    unit_price: row.unit_price as number | null,
    raw: (row.raw_data as Record<string, unknown>) ?? {},
  }));
}

export async function getProductsCatalog() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products_catalog")
    .select("id, name, official_name, short_name, is_active, standard_code")
    .eq("is_active", true)
    .order("name")
    .limit(500);
  if (error) throw error;
  return data ?? [];
}
