const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

// DATABASE_URL 형식이 필요합니다 (예: postgresql://postgres:password@localhost:54322/postgres)
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

async function applySqlDirectly() {
  console.log("시작: 데이터베이스에 RAG SQL 직접 주입 (안전 모드)...");
  
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log("DB 연결 성공.");

    const sqlPath = 'packages/supabase/migrations/00070_order_embeddings.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // SQL 파일을 세미콜론 기준으로 나누어 실행하거나 전체를 하나의 블록으로 실행
    // 여기서는 전체를 하나의 트랜잭션으로 실행합니다.
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log("성공: RAG 테이블, 함수, 트리거가 데이터베이스에 직접 생성되었습니다.");
    console.log("기존 데이터는 안전하게 보존되었습니다.");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("오류 발생:", err.message);
    console.log("\n--- 최후의 방법 ---");
    console.log("Supabase 대시보드(http://localhost:54323)의 SQL Editor에서");
    console.log("'packages/supabase/migrations/00070_order_embeddings.sql' 내용을 복사해 실행해주세요.");
  } finally {
    await client.end();
  }
}

applySqlDirectly();
