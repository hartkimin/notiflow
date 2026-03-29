import { createClient } from "@/lib/supabase/server";

export interface MobileSyncSummary {
  categories: { id: string; name: string; color: number; order_index: number; is_active: boolean; is_deleted: boolean; updated_at: number }[];
  statusSteps: { id: string; name: string; order_index: number; color: number; is_deleted: boolean; updated_at: number }[];
  filterRules: { id: string; category_id: string; sender_keywords: string[]; include_words: string[]; is_active: boolean; is_deleted: boolean; updated_at: number }[];
  appFilters: { id: string; package_name: string; app_name: string; is_allowed: boolean; is_deleted: boolean; updated_at: number }[];
  plans: { id: string; title: string; date: number; is_completed: boolean; is_deleted: boolean; updated_at: number }[];
  dayCategories: { id: string; date: number; category_id: string; updated_at: number }[];
  messageCount: number;
}

export async function getMobileSyncData(): Promise<MobileSyncSummary> {
  const supabase = await createClient();

  const [categories, statusSteps, filterRules, appFilters, plans, dayCategories, messages] = await Promise.all([
    supabase.from("categories").select("*").order("order_index"),
    supabase.from("status_steps").select("*").order("order_index"),
    supabase.from("filter_rules").select("*"),
    supabase.from("app_filters").select("*"),
    supabase.from("plans").select("*").order("date", { ascending: false }),
    supabase.from("day_categories").select("*"),
    supabase.from("captured_messages").select("id", { count: "exact", head: true }),
  ]);

  return {
    categories: categories.data ?? [],
    statusSteps: statusSteps.data ?? [],
    filterRules: filterRules.data ?? [],
    appFilters: appFilters.data ?? [],
    plans: plans.data ?? [],
    dayCategories: dayCategories.data ?? [],
    messageCount: messages.count ?? 0,
  };
}
