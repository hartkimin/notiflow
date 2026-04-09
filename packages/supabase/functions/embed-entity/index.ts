/**
 * embed-entity Edge Function
 * 
 * Vectorizes my_drugs, my_devices, hospitals, and suppliers for RAG.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateEmbedding } from "../_shared/ai-client.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OLLAMA_MODEL = "nomic-embed-text";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, entity_type, table } = payload;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let content = "";
    let tableName = "";
    let upsertData: any = {};

    if (["drug", "device"].includes(entity_type)) {
      tableName = "product_embeddings";
      const prefix = entity_type === "drug" ? "[의약품 상세정보]" : "[의료기기 상세정보]";
      content = `${prefix}\n` + Object.entries(record)
        .map(([k, v]) => `${k}: ${v}`).join(", ");
      upsertData = { product_id: record.id, product_type: entity_type, content };
    } else if (["hospital", "supplier"].includes(entity_type)) {
      tableName = "partner_embeddings";
      const prefix = entity_type === "hospital" ? "[병원 상세정보]" : "[공급사 상세정보]";
      content = `${prefix}\n` + Object.entries(record)
        .map(([k, v]) => `${k}: ${v}`).join(", ");
      upsertData = { partner_id: record.id, partner_type: entity_type, content };
    }

    if (!content) return new Response("Skipped");

    // Generate Embedding
    const embedding = await generateEmbedding("ollama", "", OLLAMA_MODEL, content);
    upsertData.embedding = embedding;
    upsertData.embedding_model = OLLAMA_MODEL;
    upsertData.embedded_at = new Date().toISOString();

    const { error } = await supabase.from(tableName).upsert(upsertData, {
      onConflict: entity_type.includes("drug") || entity_type.includes("device") 
        ? "product_id,product_type" 
        : "partner_id,partner_type"
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
