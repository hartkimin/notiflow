import { createClient } from "@/lib/supabase/server";
import type { RawMessage } from "@/lib/types";

export async function getMessages(params: {
  from?: string;
  to?: string;
  parse_status?: string;
  source_app?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ messages: RawMessage[]; total: number }> {
  const supabase = await createClient();

  let query = supabase.from("raw_messages").select("*", { count: "exact" });

  if (params.from) query = query.gte("received_at", params.from);
  if (params.to) query = query.lte("received_at", params.to);
  if (params.parse_status) query = query.eq("parse_status", params.parse_status);
  if (params.source_app) query = query.eq("source_app", params.source_app);

  query = query
    .order("received_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { messages: (data ?? []) as RawMessage[], total: count ?? 0 };
}

export async function getMessageById(id: string): Promise<RawMessage | null> {
  const supabase = await createClient();
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { data } = await supabase
    .from("raw_messages")
    .select("*")
    .eq("id", numId)
    .maybeSingle();
  return data as RawMessage | null;
}

/**
 * Get all messages in a date range (no pagination) for calendar view.
 */
export async function getMessagesForCalendar(params: {
  from: string;  // ISO date string "YYYY-MM-DD"
  to: string;    // ISO date string "YYYY-MM-DD"
}): Promise<RawMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raw_messages")
    .select("*")
    .gte("received_at", params.from)
    .lt("received_at", params.to)
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as RawMessage[];
}
