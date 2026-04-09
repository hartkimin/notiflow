const { execSync } = require('child_process');
const fs = require('fs');
const path = require('fs');

async function applyMigration() {
  console.log("시작: RAG 마이그레이션 안전 적용 (데이터 보존 모드)...");

  try {
    // 1. npx supabase migration up 실행
    // 이 명령어는 리셋 없이 '아직 적용되지 않은' 마이그레이션 파일만 순차적으로 적용합니다.
    console.log("[1/2] 새로운 마이그레이션 파일 찾는 중...");
    const output = execSync('npx supabase migration up', { encoding: 'utf-8' });
    console.log(output);

    console.log("[2/2] 데이터베이스 반영 완료.");
    console.log("\n성공: 기존 데이터는 유지되었으며, RAG 테이블과 함수가 생성되었습니다.");
    
  } catch (err) {
    console.error("\n오류 발생:");
    if (err.stdout) console.error("STDOUT:", err.stdout);
    if (err.stderr) console.error("STDERR:", err.stderr);
    
    console.log("\n--- 대안책 시도 ---");
    console.log("만약 위 명령어가 실패한다면, Supabase 대시보드의 SQL Editor에 ");
    console.log("'packages/supabase/migrations/00070_order_embeddings.sql' 내용을 복사해서 직접 붙여넣어주세요.");
  }
}

applyMigration();
