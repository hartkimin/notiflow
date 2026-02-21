import { createClient } from "@/lib/supabase/server";
import type { ChatRoom } from "@/lib/types";

export async function getChatRooms(params: {
  query?: string;
  source?: string;
} = {}): Promise<ChatRoom[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_chat_rooms", {
    p_query: params.query || null,
    p_source_filter: params.source || null,
  });

  if (error) throw error;
  return (data ?? []) as ChatRoom[];
}

export async function getAvailableApps(): Promise<
  { source: string; app_name: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("captured_messages")
    .select("source, app_name")
    .eq("is_deleted", false)
    .order("app_name");

  if (error) throw error;

  // Deduplicate by source
  const seen = new Set<string>();
  return (data ?? []).filter((row) => {
    if (seen.has(row.source)) return false;
    seen.add(row.source);
    return true;
  });
}
