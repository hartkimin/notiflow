import { createClient } from "@/lib/supabase/server";
import type { RawMessage, CapturedMessage } from "@/lib/types";

// Combine the two types for a unified display
export interface UnifiedMessage extends RawMessage {
  is_captured?: boolean;
  app_name?: string;
  room_name?: string;
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

  // 1. Fetch from raw_messages
  let rawQuery = supabase.from("raw_messages").select("*", { count: "exact" });
  if (params.from) rawQuery = rawQuery.gte("received_at", params.from);
  if (params.to) rawQuery = rawQuery.lte("received_at", params.to);
  if (params.parse_status) rawQuery = rawQuery.eq("parse_status", params.parse_status);
  if (params.source_app) rawQuery = rawQuery.eq("source_app", params.source_app);

  const { data: rawData, count: rawCount, error: rawError } = await rawQuery
    .order("received_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  if (rawError) console.error("raw_messages query error:", rawError);

  // 2. Fetch from captured_messages (from mobile)
  let capQuery = supabase.from("captured_messages").select("*", { count: "exact" });
  // Map parameters (captured_messages uses integer received_at ms epoch)
  // Convert ISO string if provided
  if (params.from) {
    const fromMs = new Date(params.from).getTime();
    if (!isNaN(fromMs)) capQuery = capQuery.gte("received_at", fromMs);
  }
  if (params.to) {
    const toMs = new Date(params.to).getTime();
    if (!isNaN(toMs)) capQuery = capQuery.lte("received_at", toMs);
  }

  const { data: capData, count: capCount, error: capError } = await capQuery
    .order("received_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  if (capError) console.error("captured_messages query error:", capError);

  // 3. Map and Merge (Unified view)
  const mappedRaw: UnifiedMessage[] = (rawData ?? []).map(m => ({
    ...m,
    is_captured: false,
    app_name: m.source_app
  }));

  const mappedCap: UnifiedMessage[] = (capData ?? []).map((m: any) => ({
    id: parseInt(m.id.toString().substring(0, 9), 10) || Math.floor(Math.random() * 1000000), // Numeric ID for UI
    content: m.content,
    received_at: new Date(m.received_at).toISOString(),
    sender: m.sender,
    parse_status: 'pending', // Default for captured
    source_app: m.app_name || 'mobile',
    is_captured: true,
    app_name: m.app_name,
    room_name: m.room_name,
    hospital_id: null,
    order_id: null,
    device_name: m.source,
    parse_result: null,
    parse_method: null,
    is_order_message: null
  }));

  // Sort combined results by date descending
  const combined = [...mappedRaw, ...mappedCap]
    .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
    .slice(0, params.limit || 50);

  return { 
    messages: combined, 
    total: (rawCount ?? 0) + (capCount ?? 0) 
  };
}

export async function getMessageById(id: string): Promise<UnifiedMessage | null> {
  const supabase = await createClient();
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  
  // Try raw_messages first
  const { data: raw } = await supabase
    .from("raw_messages")
    .select("*")
    .eq("id", numId)
    .maybeSingle();
    
  if (raw) return { ...raw, is_captured: false } as UnifiedMessage;
  
  return null; // For specific lookup, usually raw_messages is the source
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

  const [rawRes, capRes] = await Promise.all([
    supabase.from("raw_messages").select("*").gte("received_at", params.from).lt("received_at", params.to).limit(200),
    supabase.from("captured_messages").select("*").gte("received_at", fromMs).lt("received_at", toMs).limit(200)
  ]);

  const mappedRaw: UnifiedMessage[] = (rawRes.data ?? []).map(m => ({ ...m, is_captured: false }));
  const mappedCap: UnifiedMessage[] = (capRes.data ?? []).map((m: any) => ({
    id: 0, // Not critical for calendar rendering usually
    content: m.content,
    received_at: new Date(m.received_at).toISOString(),
    sender: m.sender,
    parse_status: 'pending',
    source_app: m.app_name || 'mobile',
    is_captured: true,
    app_name: m.app_name
  } as any));

  return [...mappedRaw, ...mappedCap].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
}
