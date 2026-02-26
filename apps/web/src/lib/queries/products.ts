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

export async function getProductsCatalog() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products_catalog")
    .select("id, name, official_name, short_name, is_active, standard_code");
  if (error) throw error;
  return data ?? [];
}
