import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export async function getProducts(params: {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ products: Product[]; total: number }> {
  const supabase = await createClient();

  let query = supabase.from("products").select("*", { count: "exact" });

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,official_name.ilike.%${params.search}%`);
  }
  if (params.category) query = query.eq("category", params.category);

  query = query
    .order("name")
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { products: (data ?? []) as Product[], total: count ?? 0 };
}

export async function getProduct(id: number): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Product;
}
