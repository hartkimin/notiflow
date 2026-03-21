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
    id: m.id,
    content: m.content,
    received_at: new Date(m.received_at).toISOString(),
    sender: m.sender,
    source_app: m.app_name,
    hospital_id: null,
    order_id: null,
    device_name: m.device_id,
    is_order_message: null,
    is_captured: true,
    app_name: m.app_name,
    room_name: m.room_name,
    category_id: m.category_id,
    status_id: m.status_id,
  };
}

/** Parse a date string as local timezone midnight (not UTC).
 *  "2026-03-01" → local 2026-03-01 00:00:00 epoch ms */
function localDateToMs(dateStr: string): number {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
}

export async function getMessages(params: {
  from?: string;
  to?: string;
  source_app?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ messages: UnifiedMessage[]; total: number }> {
  const supabase = await createClient();

  let query = supabase.from("captured_messages").select("*", { count: "exact" });

  // Filter by date range (convert to local-timezone epoch ms)
  if (params.from) {
    const fromMs = localDateToMs(params.from);
    if (!isNaN(fromMs)) query = query.gte("received_at", fromMs);
  }
  if (params.to) {
    const toMs = localDateToMs(params.to) + 24 * 60 * 60 * 1000 - 1;
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

export async function getMessagesByIds(ids: string[]): Promise<UnifiedMessage[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("captured_messages")
    .select("*")
    .in("id", ids)
    .eq("is_deleted", false);

  if (error) console.error("captured_messages batch query error:", JSON.stringify(error, null, 2));

  return (data ?? []).map((m) => mapCaptured(m as CapturedMessage));
}

export function formatMessagesAsNotes(messages: UnifiedMessage[]): string {
  return messages
    .map((m) => {
      const time = new Date(m.received_at).toLocaleString("ko-KR", {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });
      const source = m.app_name || m.source_app;
      return `[${source} | ${m.sender || "알 수 없음"} | ${time}]\n${m.content}`;
    })
    .join("\n---\n");
}

/**
 * Get all messages in a date range (no pagination) for calendar view.
 */
export async function getMessagesForCalendar(params: {
  from: string;
  to: string;
  source_app?: string;
}): Promise<UnifiedMessage[]> {
  const supabase = await createClient();

  const fromMs = localDateToMs(params.from);
  const toMs = localDateToMs(params.to) + 24 * 60 * 60 * 1000;

  let query = supabase
    .from("captured_messages")
    .select("*")
    .gte("received_at", fromMs)
    .lt("received_at", toMs)
    .eq("is_deleted", false);

  if (params.source_app) {
    query = query.eq("app_name", params.source_app);
  }

  const { data, error } = await query.limit(200);

  if (error) console.error("captured_messages calendar query error:", JSON.stringify(error, null, 2));

  return (data ?? [] as CapturedMessage[]).map((m) => mapCaptured(m as CapturedMessage));
}
