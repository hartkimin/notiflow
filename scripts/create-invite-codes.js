/**
 * Create initial invite codes for NotiFlow.
 * Usage:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-invite-codes.js
 *
 * These codes are single-use. Share each code with one company.
 * Check usage in Supabase dashboard: Table Editor → invite_codes
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Codes to create. Edit as needed.
// Format: XXXX-XXXX-XXXX (memorable but not guessable)
const CODES = [
  { code: "NOTI-2025-ALPHA", notes: "알파 테스트 1호" },
  { code: "NOTI-2025-BETA1", notes: "알파 테스트 2호" },
  { code: "NOTI-2025-BETA2", notes: "알파 테스트 3호" },
  { code: "NOTI-JENS-0001",  notes: "젠스코리아용 (재가입시 사용)" },
  { code: "NOTI-TEST-DEMO",  notes: "내부 테스트" },
];

async function run() {
  console.log("초대 코드 생성 중...\n");

  for (const entry of CODES) {
    const { data, error } = await admin
      .from("invite_codes")
      .upsert(entry, { onConflict: "code", ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (error) {
      console.error(`  ✗ ${entry.code} — ${error.message}`);
    } else {
      console.log(`  ✓ ${entry.code}  (${entry.notes})`);
    }
  }

  console.log("\n완료. Supabase 대시보드 → Table Editor → invite_codes 에서 확인하세요.");
  console.log("사용된 코드는 used_at 컬럼에 타임스탬프가 기록됩니다.");
}

run().catch(console.error);
