const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

if (!supabaseKey) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY is missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateEmbedding(text) {
  try {
    const safeText = text.length > 3000 ? text.substring(0, 3000) + "..." : text;
    const res = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        input: safeText
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (!data.embeddings || !data.embeddings[0]) {
      throw new Error("No embedding returned from Ollama");
    }
    return data.embeddings[0];
  } catch (err) {
    console.error("Embedding failed:", err.message);
    throw err;
  }
}

async function backfill() {
  console.log("시작: 기존 주문 데이터 임베딩 소급 적용...");

  // 1. 임베딩이 없는 주문 조회
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      hospitals(name),
      order_items(*)
    `);

  if (error) {
    console.error("주문 조회 실패:", error.message);
    return;
  }

  console.log(`총 ${orders.length}개의 주문을 처리합니다.`);

  for (const order of orders) {
    try {
      // 이미 임베딩이 있는지 확인
      const { data: existing } = await supabase
        .from('order_embeddings')
        .select('id')
        .eq('order_id', order.id)
        .single();

      if (existing) {
        console.log(`[건너뜀] 주문 ${order.order_number} (이미 임베딩됨)`);
        continue;
      }

      // 텍스트 구성 (전체 컬럼 포함)
      const hospitalInfo = Object.entries(order.hospitals || {})
        .map(([k, v]) => `${k}: ${v}`).join(", ");
      
      const itemsInfo = order.order_items.map((item, idx) => {
        return `[품목 ${idx + 1}] ` + Object.entries(item)
          .map(([k, v]) => `${k}: ${v}`).join(", ");
      }).join("\n");

      const orderInfo = Object.entries(order)
        .filter(([k]) => k !== "hospitals" && k !== "order_items")
        .map(([k, v]) => `${k}: ${v}`).join(", ");

      const content = `[주문 상세 정보]\n${orderInfo}\n` +
        `[연결된 병원 정보]\n${hospitalInfo}\n` +
        `[포함된 모든 품목 리스트]\n${itemsInfo}`;

      console.log(`[처리중] 주문 ${order.order_number}...`);
      
      const embedding = await generateEmbedding(content);

      await supabase.from('order_embeddings').upsert({
        order_id: order.id,
        content,
        embedding,
        embedding_model: 'nomic-embed-text'
      }, { onConflict: 'order_id' });

      console.log(`[완료] 주문 ${order.order_number} 벡터화 저장 성공`);
    } catch (err) {
      console.error(`[오류] 주문 ${order.order_number}:`, err.message);
    }
  }

  console.log("모든 소급 적용 작업이 완료되었습니다.");
}

backfill();
