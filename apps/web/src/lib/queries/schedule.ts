import { createClient } from "@/lib/supabase/server";
import type { MobileCategory, Plan, DayCategory, CapturedMessage, FilterRule } from "@/lib/types";

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

export async function getAllCategories(): Promise<MobileCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, order_index, is_active")
    .eq("is_deleted", false)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as MobileCategory[];
}

export async function getPlans(startMs: number, endMs: number): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, category_id, date, title, is_completed, linked_message_id, order_number, order_index")
    .eq("is_deleted", false)
    .gte("date", startMs)
    .lt("date", endMs)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function getDayCategories(startMs: number, endMs: number): Promise<DayCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_categories")
    .select("id, date, category_id")
    .gte("date", startMs)
    .lt("date", endMs);
  if (error) throw error;
  return (data ?? []) as DayCategory[];
}

export async function getMessages(startMs: number, endMs: number): Promise<CapturedMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captured_messages")
    .select("id, source, app_name, sender, content, received_at, category_id, status_id, is_archived, room_name, sender_icon, attached_image")
    .eq("is_deleted", false)
    .gte("received_at", startMs)
    .lt("received_at", endMs)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CapturedMessage[];
}

export async function getFilterRules(): Promise<FilterRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("filter_rules")
    .select("id, category_id, sender_keywords, sender_match_type, sms_phone_number, include_words, exclude_words, include_match_type, condition_type, target_app_packages, is_active")
    .eq("is_deleted", false)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as FilterRule[];
}

// Backward-compatible wrappers (used until page.tsx is updated)
export function getWeekPlans(weekStartMs: number) {
  return getPlans(weekStartMs, weekStartMs + 7 * 24 * 60 * 60 * 1000);
}
export function getWeekDayCategories(weekStartMs: number) {
  return getDayCategories(weekStartMs, weekStartMs + 7 * 24 * 60 * 60 * 1000);
}
export function getWeekMessages(weekStartMs: number) {
  return getMessages(weekStartMs, weekStartMs + 7 * 24 * 60 * 60 * 1000);
}
