const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateEmbedding(text) {
  try {
    // Very strict truncation for local context safety
    const safeText = text.length > 3000 ? text.substring(0, 3000) + "..." : text;
    const res = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: safeText })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (!data.embeddings || !data.embeddings[0]) {
      throw new Error(`No embedding returned from Ollama for text: ${text.substring(0, 50)}...`);
    }
    return data.embeddings[0];
  } catch (err) {
    console.error("Embedding generation failed:", err.message);
    throw err;
  }
}

async function backfillEntities() {
  console.log("시작: 품목 및 거래처 데이터 임베딩 소급 적용...");

  // 1. Drugs
  const { data: drugs } = await supabase.from('my_drugs').select('*');
  for (const r of drugs || []) {
    const content = `[의약품 상세정보]\n` + Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ");
    const embedding = await generateEmbedding(content);
    await supabase.from('product_embeddings').upsert({ product_id: r.id, product_type: 'drug', content, embedding, embedding_model: 'nomic-embed-text' }, { onConflict: 'product_id,product_type' });
    console.log(`[완료] 의약품: ${r.item_name}`);
  }

  // 2. Devices
  const { data: devices } = await supabase.from('my_devices').select('*');
  for (const r of devices || []) {
    const content = `[의료기기 상세정보]\n` + Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ");
    const embedding = await generateEmbedding(content);
    await supabase.from('product_embeddings').upsert({ product_id: r.id, product_type: 'device', content, embedding, embedding_model: 'nomic-embed-text' }, { onConflict: 'product_id,product_type' });
    console.log(`[완료] 의료기기: ${r.prdlst_nm}`);
  }

  // 3. Hospitals
  const { data: hospitals } = await supabase.from('hospitals').select('*');
  for (const r of hospitals || []) {
    const content = `[병원 상세정보]\n` + Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ");
    const embedding = await generateEmbedding(content);
    await supabase.from('partner_embeddings').upsert({ partner_id: r.id, partner_type: 'hospital', content, embedding, embedding_model: 'nomic-embed-text' }, { onConflict: 'partner_id,partner_type' });
    console.log(`[완료] 병원: ${r.name}`);
  }

  // 4. Suppliers
  const { data: suppliers } = await supabase.from('suppliers').select('*');
  for (const r of suppliers || []) {
    const content = `[공급사 상세정보]\n` + Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ");
    const embedding = await generateEmbedding(content);
    await supabase.from('partner_embeddings').upsert({ partner_id: r.id, partner_type: 'supplier', content, embedding, embedding_model: 'nomic-embed-text' }, { onConflict: 'partner_id,partner_type' });
    console.log(`[완료] 공급사: ${r.name}`);
  }

  console.log("모든 품목 및 거래처 소급 적용 완료.");
}

backfillEntities();
