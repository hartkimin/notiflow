const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRAG(question) {
  console.log(`[테스트 질문]: "${question}"`);

  // 1. 질문을 벡터화
  const res = await fetch(`${ollamaUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: question })
  });
  const { embeddings } = await res.json();
  const queryEmbedding = embeddings[0];

  // 2. 통합 RAG 검색 (주문, 품목, 거래처)
  console.log("--- RAG 검색 결과 ---");
  
  const { data: products } = await supabase.rpc('match_products_rag', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 2
  });

  const { data: orders } = await supabase.rpc('match_orders', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 2
  });

  console.log("\n[연관 품목]:");
  products.forEach(p => console.log(`- ${p.content.substring(0, 100)}... (유사도: ${p.similarity.toFixed(4)})`));

  console.log("\n[연관 주문]:");
  orders.forEach(o => console.log(`- ${o.content.substring(0, 100)}... (유사도: ${o.similarity.toFixed(4)})`));
}

// "네스벨" 키워드로 테스트
testRAG("네스벨 성분이 뭐야?");
