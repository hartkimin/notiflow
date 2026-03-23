import { createClient } from "@/lib/supabase/server";
import type { Supplier } from "@/lib/types";

export async function getSuppliers(params: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ suppliers: Supplier[]; total: number }> {
  const supabase = await createClient();

  let query = supabase.from("suppliers").select("*", { count: "exact" });

  if (params.search) query = query.ilike("name", `%${params.search}%`);

  query = query
    .order("name")
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { suppliers: (data ?? []) as Supplier[], total: count ?? 0 };
}

export async function searchSuppliersRpc(query: string, limit: number = 20): Promise<Array<{
  id: number;
  name: string;
  short_name: string | null;
  phone: string | null;
  ceo_name: string | null;
  business_category: string | null;
}>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_suppliers", {
    query,
    result_limit: limit,
  });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    name: string;
    short_name: string | null;
    phone: string | null;
    ceo_name: string | null;
    business_category: string | null;
  }>;
}

export async function getSupplier(id: number): Promise<Supplier> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Supplier;
}
