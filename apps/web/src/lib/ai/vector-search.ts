import { createAdminClient } from "@/lib/supabase/admin";

export interface VectorMatch {
  id: number;
  name: string;
  similarity: number;
  type: string;
}

export interface MessageMatch {
  id: string;
  content: string;
  sender: string | null;
  similarity: number;
}

export interface HospitalMatch {
  id: number;
  name: string;
  similarity: number;
}

/** Convert number[] to pgvector literal string: "[0.1,0.2,...]" */
function toPgVector(embedding: number[]): string {
  return "[" + embedding.join(",") + "]";
}

export async function searchProducts(
  embedding: number[],
  limit = 5,
  threshold = 0.6,
): Promise<VectorMatch[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: toPgVector(embedding),
    match_threshold: threshold,
    match_count: limit,
  });
  if (error) { console.warn("[vector-search] match_products error:", error.message); return []; }
  return (data ?? []) as VectorMatch[];
}

export async function searchSimilarMessages(
  embedding: number[],
  senderFilter?: string | null,
  limit = 3,
): Promise<MessageMatch[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_messages", {
    query_embedding: toPgVector(embedding),
    sender_filter: senderFilter ?? null,
    match_count: limit,
  });
  if (error) { console.warn("[vector-search] match_messages error:", error.message); return []; }
  return (data ?? []) as MessageMatch[];
}

export async function searchHospitals(
  embedding: number[],
  limit = 3,
): Promise<HospitalMatch[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_hospitals", {
    query_embedding: toPgVector(embedding),
    match_count: limit,
  });
  if (error) { console.warn("[vector-search] match_hospitals error:", error.message); return []; }
  return (data ?? []) as HospitalMatch[];
}

/** Store embedding for a captured message (async, fire-and-forget) */
export async function storeMessageEmbedding(
  messageId: string,
  embedding: number[],
  model: string,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("captured_messages").update({
    embedding: toPgVector(embedding),
    embedding_model: model,
    embedded_at: new Date().toISOString(),
  }).eq("id", messageId);
}
