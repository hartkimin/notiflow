import { createClient } from "@/lib/supabase/server";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

export async function getCategories(): Promise<MobileCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, order_index, is_active")
    .eq("is_deleted", false)
    .eq("is_active", true)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as MobileCategory[];
}

export async function getWeekPlans(weekStartMs: number): Promise<Plan[]> {
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, category_id, date, title, is_completed, linked_message_id, order_number, order_index")
    .eq("is_deleted", false)
    .gte("date", weekStartMs)
    .lt("date", weekEndMs)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function getWeekDayCategories(weekStartMs: number): Promise<DayCategory[]> {
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_categories")
    .select("id, date, category_id")
    .gte("date", weekStartMs)
    .lt("date", weekEndMs);
  if (error) throw error;
  return (data ?? []) as DayCategory[];
}

export async function getWeekMessages(weekStartMs: number): Promise<CapturedMessage[]> {
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captured_messages")
    .select("id, source, app_name, sender, content, received_at, category_id, status_id, is_archived, room_name, sender_icon, attached_image")
    .eq("is_deleted", false)
    .gte("received_at", weekStartMs)
    .lt("received_at", weekEndMs)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CapturedMessage[];
}
