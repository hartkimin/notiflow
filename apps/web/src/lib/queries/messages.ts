import { createClient } from "@/lib/supabase/server";
import type { RawMessage, CapturedMessage } from "@/lib/types";

// UnifiedMessage extends RawMessage for backward compat with existing UI components,
// while adding captured_messages-specific fields.
export interface UnifiedMessage extends RawMessage {
  is_captured: boolean;
  app_name: string;
  room_name: string | null;
  category_id?: string | null;
  status_id?: string | null;
}

function mapCaptured(m: CapturedMessage): UnifiedMessage {
  return {
    // RawMessage legacy fields (defaults for removed raw_messages table)
    id: Number(m.id),
    content: m.content,
    received_at: new Date(m.received_at).toISOString(),
    sender: m.sender,
    parse_status: "skipped",
    source_app: m.app_name,
    hospital_id: null,
    order_id: null,
    device_name: m.device_id,
    parse_result: null,
    parse_method: null,
    is_order_message: null,
    // UnifiedMessage fields
    is_captured: true,
    app_name: m.app_name,
    room_name: m.room_name,
    category_id: m.category_id,
    status_id: m.status_id,
  };
}

export async function getMessages(params: {
  from?: string;
  to?: string;
  parse_status?: string;
  source_app?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ messages: UnifiedMessage[]; total: number }> {
  const supabase = await createClient();

  let query = supabase.from("captured_messages").select("*", { count: "exact" });

  // Filter by date range (convert ISO to epoch ms)
  if (params.from) {
    const fromMs = new Date(params.from).getTime();
    if (!isNaN(fromMs)) query = query.gte("received_at", fromMs);
  }
  if (params.to) {
    const toMs = new Date(params.to).getTime();
    if (!isNaN(toMs)) query = query.lte("received_at", toMs);
  }
  if (params.source_app) {
    query = query.eq("app_name", params.source_app);
  }

  // Exclude soft-deleted
  query = query.eq("is_deleted", false);

  const { data, count, error } = await query
    .order("received_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  if (error) console.error("captured_messages query error:", JSON.stringify(error, null, 2));

  const messages = (data ?? [] as CapturedMessage[]).map((m) => mapCaptured(m as CapturedMessage));

  return { messages, total: count ?? 0 };
}

export async function getMessageById(id: string): Promise<UnifiedMessage | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("captured_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return mapCaptured(data as CapturedMessage);
}

/**
 * Get all messages in a date range (no pagination) for calendar view.
 */
export async function getMessagesForCalendar(params: {
  from: string;
  to: string;
}): Promise<UnifiedMessage[]> {
  const supabase = await createClient();

  const fromMs = new Date(params.from).getTime();
  const toMs = new Date(params.to).getTime();

  const { data, error } = await supabase
    .from("captured_messages")
    .select("*")
    .gte("received_at", fromMs)
    .lt("received_at", toMs)
    .eq("is_deleted", false)
    .limit(200);

  if (error) console.error("captured_messages calendar query error:", JSON.stringify(error, null, 2));

  return (data ?? [] as CapturedMessage[]).map((m) => mapCaptured(m as CapturedMessage));
}
