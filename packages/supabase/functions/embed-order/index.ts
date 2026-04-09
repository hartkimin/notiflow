/**
 * embed-order Edge Function
 *
 * Triggered by DB webhook on INSERT to 'orders' table.
 * Fetches order details, generates a text chunk, vectorizes it,
 * and saves to 'order_embeddings' for RAG.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateEmbedding, resolveAIProvider } from "../_shared/ai-client.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, type, table } = payload;

    if (!["INSERT", "UPDATE"].includes(type) || table !== "orders") {
      return new Response(JSON.stringify({ skipped: "Not an order INSERT/UPDATE" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch full order details including hospital and items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(`
        *,
        hospitals(name),
        order_items(*)
      `)
      .eq("id", record.id)
      .single();

    if (orderErr || !order) {
      throw new Error(`Failed to fetch order: ${orderErr?.message}`);
    }

    // 2. Format content for RAG (ALL COLUMNS)
    const hospitalInfo = Object.entries(order.hospitals || {})
      .map(([k, v]) => `${k}: ${v}`).join(", ");
    
    const itemsInfo = order.order_items.map((item: any, idx: number) => {
      return `[품목 ${idx + 1}] ` + Object.entries(item)
        .map(([k, v]) => `${k}: ${v}`).join(", ");
    }).join("\n");

    const orderInfo = Object.entries(order)
      .filter(([k]) => k !== "hospitals" && k !== "order_items")
      .map(([k, v]) => `${k}: ${v}`).join(", ");

    let content = `[주문 상세 정보]\n${orderInfo}\n` +
      `[연결된 병원 정보]\n${hospitalInfo}\n` +
      `[포함된 모든 품목 리스트]\n${itemsInfo}`;

    // Safety truncation (Ollama token limit)
    if (content.length > 8000) {
      content = content.substring(0, 8000) + "... (데이터가 너무 길어 하단 생략)";
    }

    // 3. Strict Local Ollama Configuration
    // host.docker.internal is used to reach Ollama running on the host machine from inside the Supabase Docker container
    const OLLAMA_MODEL = "nomic-embed-text";
    
    // 4. Generate Embedding with Retry logic
    let embedding: number[] = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        embedding = await generateEmbedding(
          "ollama", // Force Ollama
          "",       // No API Key needed
          OLLAMA_MODEL,
          content
        );
        break; // Success
      } catch (err) {
        if (attempts === maxAttempts) throw err;
        console.warn(`[embed-order] Ollama attempt ${attempts} failed, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 5. Save Embedding (UPSERT)
    const { error: saveErr } = await supabase
      .from("order_embeddings")
      .upsert({
        order_id: order.id,
        content,
        embedding,
        embedding_model: OLLAMA_MODEL,
        embedded_at: new Date().toISOString()
      }, {
        onConflict: "order_id"
      });

    if (saveErr) {
      throw new Error(`Failed to save embedding: ${saveErr.message}`);
    }

    return new Response(JSON.stringify({ success: true, order_id: order.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[embed-order] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
