/**
 * Seed demo organization's my_drugs with realistic hemodialysis clinic formulary.
 * Usage:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo-my-drugs.js
 *
 * Safe to re-run — uses upsert on item_seq + organization_id.
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// item_seq values from mfds_drugs to seed as demo my_drugs
// Typical hemodialysis clinic (혈액투석 의원) formulary
const DEMO_DRUG_SEQ = [
  { item_seq: "199703027", alias: "에스포젠", unit_price: 12500 },  // ESA (에리스로포이에틴)
  { item_seq: "197300034", alias: "헤파린주",  unit_price: 3200  },  // 헤파린
  { item_seq: "201004013", alias: "페린젝트",  unit_price: 55000 },  // 철분 (IV iron)
  { item_seq: "200108806", alias: "젬플라",    unit_price: 8800  },  // 파리칼시톨 (active VitD)
  { item_seq: "199300288", alias: "본키캡슐",  unit_price: 1200  },  // 칼시트리올
  { item_seq: "200603879", alias: "포스레놀",  unit_price: 4500  },  // 인산결합제
  { item_seq: "201108203", alias: "렌벨라",    unit_price: 3800  },  // 인산결합제
  { item_seq: "195700009", alias: "생리식염수", unit_price: 1800  }, // 생리식염수 500mL
];

async function run() {
  // Find demo org
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name")
    .eq("is_demo", true)
    .single();

  if (orgErr || !org) {
    console.error("Demo org not found:", orgErr?.message);
    process.exit(1);
  }
  const DEMO_ORG_ID = org.id;
  console.log(`Demo org: ${org.name} (${DEMO_ORG_ID})\n`);

  // Check already seeded
  const { count } = await admin
    .from("my_drugs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", DEMO_ORG_ID);

  if (count && count > 0) {
    console.log(`Already seeded: ${count} records. Use --force to re-seed.`);
    if (!process.argv.includes("--force")) process.exit(0);
    // Delete existing and re-seed
    await admin.from("my_drugs").delete().eq("organization_id", DEMO_ORG_ID);
    console.log("Deleted existing demo my_drugs.\n");
  }

  // Fetch source rows from mfds_drugs
  const seqs = DEMO_DRUG_SEQ.map((d) => d.item_seq);
  const { data: mfds, error: mfdsErr } = await admin
    .from("mfds_drugs")
    .select("*")
    .in("item_seq", seqs);

  if (mfdsErr || !mfds) {
    console.error("Failed to fetch mfds_drugs:", mfdsErr?.message);
    process.exit(1);
  }

  // Build insert rows
  const rows = mfds.map((src) => {
    const meta = DEMO_DRUG_SEQ.find((d) => d.item_seq === src.item_seq);
    return {
      item_seq:       src.item_seq,
      item_name:      src.item_name,
      item_eng_name:  src.item_eng_name ?? null,
      entp_name:      src.entp_name ?? null,
      entp_no:        src.entp_no ?? null,
      item_permit_date: src.item_permit_date ?? null,
      bar_code:       null, // mfds_drugs stores comma-separated multi-codes; skip to avoid unique constraint
      edi_code:       src.edi_code ?? null,
      pack_unit:      src.pack_unit ?? null,
      etc_otc_code:   src.etc_otc_code ?? null,
      storage_method: src.storage_method ?? null,
      valid_term:     src.valid_term ?? null,
      material_name:  src.material_name ?? null,
      atc_code:       src.atc_code ?? null,
      cancel_date:    src.cancel_date ?? null,
      cancel_name:    src.cancel_name ?? null,
      alias:          meta?.alias ?? null,
      unit_price:     meta?.unit_price ?? null,
      organization_id: DEMO_ORG_ID,
    };
  });

  const { error: insertErr } = await admin.from("my_drugs").insert(rows);
  if (insertErr) {
    console.error("Insert failed:", insertErr.message);
    process.exit(1);
  }

  console.log(`✓ Seeded ${rows.length} demo my_drugs:`);
  rows.forEach((r) => console.log(`  - ${r.alias ?? r.item_name} (${r.item_seq})`));
  console.log("\n완료.");
}

run().catch(console.error);
