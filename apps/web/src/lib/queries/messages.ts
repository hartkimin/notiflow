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
