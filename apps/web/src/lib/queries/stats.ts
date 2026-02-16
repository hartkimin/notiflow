import { createClient } from "@/lib/supabase/server";
import type { DailyStats, CalendarDay } from "@/lib/types";

export async function getDailyStats(date?: string): Promise<DailyStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_stats", {
    target_date: date || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data as DailyStats;
}

export async function getCalendarStats(
  month: string,
): Promise<{ month: string; days: CalendarDay[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_calendar_stats", {
    target_month: month,
  });
  if (error) throw error;
  return data as { month: string; days: CalendarDay[] };
}
