import { createClient } from "@/lib/supabase/server";
import type { Hospital } from "@/lib/types";

export async function getHospitals(params: {
  search?: string;
  type?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ hospitals: Hospital[]; total: number }> {
  const supabase = await createClient();

  let query = supabase.from("hospitals").select("*", { count: "exact" });

  if (params.search) query = query.ilike("name", `%${params.search}%`);
  if (params.type) query = query.eq("hospital_type", params.type);

  query = query
    .order("name")
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { hospitals: (data ?? []) as Hospital[], total: count ?? 0 };
}

export async function getHospital(id: number): Promise<Hospital> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hospitals")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Hospital;
}
