import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HospitalStat, ProductStat, TrendPoint } from "@/lib/types";

export interface DailyStats {
  date: string;
  orders_created: number;
}

export async function getDailyStats(date?: string): Promise<DailyStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_stats", {
    target_date: date || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data as DailyStats;
}

// 30일 집계 RPC는 비용이 크므로 60초 캐싱 (orders 변경 시 revalidate 가능)
export const getHospitalStats = unstable_cache(
  async (fromDate?: string, toDate?: string): Promise<HospitalStat[]> => {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc("get_hospital_stats", {
      from_date: fromDate || thirtyDaysAgo,
      to_date: toDate || today,
    });
    if (error) throw error;
    return data as HospitalStat[];
  },
  ["hospital-stats"],
  { revalidate: 60, tags: ["stats"] },
);

export const getProductStats = unstable_cache(
  async (fromDate?: string, toDate?: string): Promise<ProductStat[]> => {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc("get_product_stats", {
      from_date: fromDate || thirtyDaysAgo,
      to_date: toDate || today,
    });
    if (error) throw error;
    return data as ProductStat[];
  },
  ["product-stats"],
  { revalidate: 60, tags: ["stats"] },
);

export const getTrendStats = unstable_cache(
  async (fromDate?: string, toDate?: string): Promise<TrendPoint[]> => {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc("get_trend_stats", {
      from_date: fromDate || thirtyDaysAgo,
      to_date: toDate || today,
    });
    if (error) throw error;
    return data as TrendPoint[];
  },
  ["trend-stats"],
  { revalidate: 60, tags: ["stats"] },
);
