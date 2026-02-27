import { createClient } from "@/lib/supabase/server";
import type { CapturedMessage } from "@/lib/types";

/**
 * Get paginated messages from captured_messages.
 * received_at is stored as epoch ms (bigint), so date filtering uses numeric comparison.
 */
export async function getMessages(params: {
  from?: string;
  to?: string;
  source?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ data: CapturedMessage[]; count: number }> {
  const supabase = await createClient();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = supabase
    .from("captured_messages")
    .select(
      "id, app_name, sender, content, received_at, category_id, status_id, is_archived, source, room_name, sender_icon, attached_image",
      { count: "exact" },
    )
    .eq("is_deleted", false)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.from) {
    const fromMs = new Date(params.from + "T00:00:00").getTime();
    query = query.gte("received_at", fromMs);
  }
  if (params.to) {
    const toMs = new Date(params.to + "T23:59:59.999").getTime();
    query = query.lte("received_at", toMs);
  }
  if (params.source && params.source !== "all") {
    query = query.eq("source", params.source);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data ?? []) as CapturedMessage[], count: count ?? 0 };
}

/**
 * Get messages in a date range for calendar view.
 * startMs/endMs are epoch milliseconds.
 */
export async function getMessagesForCalendar(params: {
  startMs: number;
  endMs: number;
}): Promise<CapturedMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("captured_messages")
    .select(
      "id, app_name, sender, content, received_at, category_id, status_id, is_archived, source, room_name, sender_icon, attached_image",
    )
    .eq("is_deleted", false)
    .gte("received_at", params.startMs)
    .lt("received_at", params.endMs)
    .order("received_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as CapturedMessage[];
}
