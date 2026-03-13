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
  const q = `%${query}%`;

  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase
      .from("my_drugs")
      .select("*")
      .or(`item_name.ilike.${q},bar_code.ilike.${q},entp_name.ilike.${q},edi_code.ilike.${q}`)
      .limit(20),
    supabase
      .from("my_devices")
      .select("*")
      .or(`prdlst_nm.ilike.${q},udidi_cd.ilike.${q},mnft_iprt_entp_nm.ilike.${q}`)
      .limit(20),
  ]);

  const results: Array<{
    id: number;
    type: "drug" | "device";
    name: string;
    code: string | null;
    manufacturer: string | null;
    unit_price: number | null;
    raw: Record<string, unknown>;
  }> = [];
  for (const d of drugs ?? []) {
    results.push({
      id: d.id,
      type: "drug" as const,
      name: d.item_name ?? "",
      code: d.bar_code,
      manufacturer: d.entp_name,
      unit_price: d.unit_price,
      raw: d as Record<string, unknown>,
    });
  }
  for (const d of devices ?? []) {
    results.push({
      id: d.id,
      type: "device" as const,
      name: d.prdlst_nm ?? "",
      code: d.udidi_cd,
      manufacturer: d.mnft_iprt_entp_nm,
      unit_price: d.unit_price,
      raw: d as Record<string, unknown>,
    });
  }
  return results;
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
