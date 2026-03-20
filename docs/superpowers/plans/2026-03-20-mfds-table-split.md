# MFDS Table Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `mfds_items` into `mfds_drugs` and `mfds_devices` with all fields as individual columns (no `raw_data` JSONB), and update all consuming code.

**Architecture:** One migration creates both new tables, migrates existing data from `raw_data`, and creates a compatibility view. Code changes swap table references and remove `raw_data` usage. The old `mfds_items` table is kept temporarily for safety.

**Tech Stack:** PostgreSQL, TypeScript, Next.js, Supabase

---

### Task 1: Create migration — new tables + data migration

**Files:**
- Create: `packages/supabase/migrations/00047_mfds_table_split.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 00047_mfds_table_split.sql
-- Split mfds_items into mfds_drugs + mfds_devices with normalized columns

-- ============================================================
-- 1. mfds_drugs (의약품 — PK: item_seq 품목기준코드)
-- ============================================================
CREATE TABLE IF NOT EXISTS mfds_drugs (
  id                    BIGSERIAL PRIMARY KEY,
  item_seq              TEXT NOT NULL UNIQUE,          -- 품목기준코드 (ITEM_SEQ)
  item_name             TEXT NOT NULL,                 -- 품목명
  item_eng_name         TEXT,                          -- 영문명
  entp_name             TEXT,                          -- 업체명
  entp_eng_name         TEXT,                          -- 업체영문명
  entp_no               TEXT,                          -- 업체번호
  item_permit_date      TEXT,                          -- 허가일자
  cnsgn_manuf           TEXT,                          -- 위탁제조업체
  etc_otc_code          TEXT,                          -- 전문/일반
  chart                 TEXT,                          -- 성상
  bar_code              TEXT,                          -- 바코드
  material_name         TEXT,                          -- 원료성분
  storage_method        TEXT,                          -- 저장방법
  valid_term            TEXT,                          -- 유효기간
  pack_unit             TEXT,                          -- 포장단위
  edi_code              TEXT,                          -- 보험코드
  atc_code              TEXT,                          -- ATC코드
  main_item_ingr        TEXT,                          -- 주성분
  main_ingr_eng         TEXT,                          -- 주성분영문
  ingr_name             TEXT,                          -- 첨가제
  total_content         TEXT,                          -- 총량
  permit_kind_name      TEXT,                          -- 허가종류
  make_material_flag    TEXT,                          -- 완제/원료
  newdrug_class_name    TEXT,                          -- 신약분류
  induty_type           TEXT,                          -- 업종
  cancel_date           TEXT,                          -- 취소일자
  cancel_name           TEXT,                          -- 상태(정상/취소)
  change_date           TEXT,                          -- 변경일자
  gbn_name              TEXT,                          -- 변경이력
  narcotic_kind_code    TEXT,                          -- 마약류코드
  rare_drug_yn          TEXT,                          -- 희귀의약품여부
  reexam_date           TEXT,                          -- 재심사일자
  reexam_target         TEXT,                          -- 재심사대상
  bizrno                TEXT,                          -- 사업자번호
  ee_doc_id             TEXT,                          -- 효능효과 문서ID
  ud_doc_id             TEXT,                          -- 용법용량 문서ID
  nb_doc_id             TEXT,                          -- 주의사항 문서ID
  insert_file           TEXT,                          -- 첨부파일
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_item_name_trgm ON mfds_drugs USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_entp_name_trgm ON mfds_drugs USING gin (entp_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_bar_code ON mfds_drugs (bar_code) WHERE bar_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_edi_code ON mfds_drugs (edi_code) WHERE edi_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_atc_code ON mfds_drugs (atc_code) WHERE atc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_permit_date ON mfds_drugs (item_permit_date) WHERE item_permit_date IS NOT NULL;

-- Trigger
CREATE TRIGGER update_mfds_drugs_updated_at
  BEFORE UPDATE ON mfds_drugs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE mfds_drugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_drugs"
  ON mfds_drugs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_drugs"
  ON mfds_drugs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 2. mfds_devices (의료기기 UDI — PK: udidi_cd)
-- ============================================================
CREATE TABLE IF NOT EXISTS mfds_devices (
  id                          BIGSERIAL PRIMARY KEY,
  udidi_cd                    TEXT NOT NULL UNIQUE,     -- UDI-DI코드
  prdlst_nm                   TEXT NOT NULL,            -- 품목명
  prdt_nm_info                TEXT,                     -- 모델명
  mnft_iprt_entp_nm           TEXT,                     -- 업체명
  permit_no                   TEXT,                     -- 허가번호
  prmsn_ymd                   TEXT,                     -- 허가일자
  mdeq_clsf_no                TEXT,                     -- 분류번호
  clsf_no_grad_cd             TEXT,                     -- 등급
  foml_info                   TEXT,                     -- 형태정보
  use_purps_cont              TEXT,                     -- 사용목적
  hmbd_trspt_mdeq_yn          TEXT,                     -- 이식형여부
  dspsbl_mdeq_yn              TEXT,                     -- 1회용여부
  trck_mng_trgt_yn            TEXT,                     -- 추적관리대상
  rcprslry_trgt_yn            TEXT,                     -- 급여대상
  total_dev                   TEXT,                     -- 전체기기
  cmbnmd_yn                   TEXT,                     -- 복합의료기기
  use_before_strlzt_need_yn   TEXT,                     -- 사전멸균필요
  sterilization_method_nm     TEXT,                     -- 멸균방법
  strg_cnd_info               TEXT,                     -- 저장조건
  circ_cnd_info               TEXT,                     -- 유통조건
  synced_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mfds_devices_prdlst_nm_trgm ON mfds_devices USING gin (prdlst_nm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_devices_entp_nm_trgm ON mfds_devices USING gin (mnft_iprt_entp_nm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_devices_permit_no ON mfds_devices (permit_no) WHERE permit_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_devices_clsf_no ON mfds_devices (mdeq_clsf_no) WHERE mdeq_clsf_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_devices_prmsn_ymd ON mfds_devices (prmsn_ymd) WHERE prmsn_ymd IS NOT NULL;

-- Trigger
CREATE TRIGGER update_mfds_devices_updated_at
  BEFORE UPDATE ON mfds_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE mfds_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_devices"
  ON mfds_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_devices"
  ON mfds_devices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Migrate existing data from mfds_items
-- ============================================================

-- Drugs
INSERT INTO mfds_drugs (
  item_seq, item_name, item_eng_name, entp_name, entp_eng_name, entp_no,
  item_permit_date, cnsgn_manuf, etc_otc_code, chart, bar_code,
  material_name, storage_method, valid_term, pack_unit, edi_code,
  atc_code, main_item_ingr, main_ingr_eng, ingr_name, total_content,
  permit_kind_name, make_material_flag, newdrug_class_name, induty_type,
  cancel_date, cancel_name, change_date, gbn_name,
  narcotic_kind_code, rare_drug_yn, reexam_date, reexam_target,
  bizrno, ee_doc_id, ud_doc_id, nb_doc_id, insert_file, synced_at
)
SELECT
  source_key,
  item_name,
  raw_data->>'ITEM_ENG_NAME',
  manufacturer,
  raw_data->>'ENTP_ENG_NAME',
  raw_data->>'ENTP_NO',
  permit_date,
  raw_data->>'CNSGN_MANUF',
  raw_data->>'ETC_OTC_CODE',
  raw_data->>'CHART',
  standard_code,
  raw_data->>'MATERIAL_NAME',
  raw_data->>'STORAGE_METHOD',
  raw_data->>'VALID_TERM',
  raw_data->>'PACK_UNIT',
  raw_data->>'EDI_CODE',
  raw_data->>'ATC_CODE',
  raw_data->>'MAIN_ITEM_INGR',
  raw_data->>'MAIN_INGR_ENG',
  raw_data->>'INGR_NAME',
  raw_data->>'TOTAL_CONTENT',
  raw_data->>'PERMIT_KIND_NAME',
  raw_data->>'MAKE_MATERIAL_FLAG',
  raw_data->>'NEWDRUG_CLASS_NAME',
  raw_data->>'INDUTY_TYPE',
  raw_data->>'CANCEL_DATE',
  raw_data->>'CANCEL_NAME',
  raw_data->>'CHANGE_DATE',
  raw_data->>'GBN_NAME',
  raw_data->>'NARCOTIC_KIND_CODE',
  raw_data->>'RARE_DRUG_YN',
  raw_data->>'REEXAM_DATE',
  raw_data->>'REEXAM_TARGET',
  raw_data->>'BIZRNO',
  raw_data->>'EE_DOC_ID',
  raw_data->>'UD_DOC_ID',
  raw_data->>'NB_DOC_ID',
  raw_data->>'INSERT_FILE',
  synced_at
FROM mfds_items
WHERE source_type = 'drug'
ON CONFLICT (item_seq) DO NOTHING;

-- Devices
INSERT INTO mfds_devices (
  udidi_cd, prdlst_nm, prdt_nm_info, mnft_iprt_entp_nm, permit_no,
  prmsn_ymd, mdeq_clsf_no, clsf_no_grad_cd, foml_info, use_purps_cont,
  hmbd_trspt_mdeq_yn, dspsbl_mdeq_yn, trck_mng_trgt_yn, rcprslry_trgt_yn,
  total_dev, cmbnmd_yn, use_before_strlzt_need_yn,
  sterilization_method_nm, strg_cnd_info, circ_cnd_info, synced_at
)
SELECT
  source_key,
  item_name,
  raw_data->>'PRDT_NM_INFO',
  manufacturer,
  raw_data->>'PERMIT_NO',
  permit_date,
  raw_data->>'MDEQ_CLSF_NO',
  raw_data->>'CLSF_NO_GRAD_CD',
  raw_data->>'FOML_INFO',
  raw_data->>'USE_PURPS_CONT',
  raw_data->>'HMBD_TRSPT_MDEQ_YN',
  raw_data->>'DSPSBL_MDEQ_YN',
  raw_data->>'TRCK_MNG_TRGT_YN',
  raw_data->>'RCPRSLRY_TRGT_YN',
  raw_data->>'TOTAL_DEV',
  raw_data->>'CMBNMD_YN',
  raw_data->>'USE_BEFORE_STRLZT_NEED_YN',
  raw_data->>'STERILIZATION_METHOD_NM',
  raw_data->>'STRG_CND_INFO',
  raw_data->>'CIRC_CND_INFO',
  synced_at
FROM mfds_items
WHERE source_type = 'device_std'
ON CONFLICT (udidi_cd) DO NOTHING;

-- ============================================================
-- 4. Compatibility view (for gradual migration)
-- ============================================================
CREATE OR REPLACE VIEW mfds_items_view AS
  SELECT id, 'drug'::text AS source_type, item_seq AS source_key,
         item_name, entp_name AS manufacturer, bar_code AS standard_code,
         item_permit_date AS permit_date, synced_at
  FROM mfds_drugs
  UNION ALL
  SELECT id, 'device_std'::text AS source_type, udidi_cd AS source_key,
         prdlst_nm AS item_name, mnft_iprt_entp_nm AS manufacturer, udidi_cd AS standard_code,
         prmsn_ymd AS permit_date, synced_at
  FROM mfds_devices;
```

- [ ] **Step 2: Apply migration**

Run: `cd packages/supabase && npx supabase migration up --local`

- [ ] **Step 3: Verify data migration**

Run queries to confirm counts match:
```bash
# Drug count in new table should match old
curl ... "$BASE/rest/v1/mfds_drugs?select=id&limit=0" -H "Prefer: count=exact"
# Device count in new table should match old
curl ... "$BASE/rest/v1/mfds_devices?select=id&limit=0" -H "Prefer: count=exact"
```

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/migrations/00047_mfds_table_split.sql
git commit -m "feat: create mfds_drugs and mfds_devices tables with data migration"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Replace MfdsItem with MfdsDrug + MfdsDevice**

Find the `MfdsItem` interface (around line 507-518) and replace with:

```typescript
/** Row from mfds_drugs table (의약품) */
export interface MfdsDrug {
  id: number;
  item_seq: string;
  item_name: string;
  item_eng_name: string | null;
  entp_name: string | null;
  entp_eng_name: string | null;
  entp_no: string | null;
  item_permit_date: string | null;
  cnsgn_manuf: string | null;
  etc_otc_code: string | null;
  chart: string | null;
  bar_code: string | null;
  material_name: string | null;
  storage_method: string | null;
  valid_term: string | null;
  pack_unit: string | null;
  edi_code: string | null;
  atc_code: string | null;
  main_item_ingr: string | null;
  main_ingr_eng: string | null;
  ingr_name: string | null;
  total_content: string | null;
  permit_kind_name: string | null;
  make_material_flag: string | null;
  newdrug_class_name: string | null;
  induty_type: string | null;
  cancel_date: string | null;
  cancel_name: string | null;
  change_date: string | null;
  gbn_name: string | null;
  narcotic_kind_code: string | null;
  rare_drug_yn: string | null;
  reexam_date: string | null;
  reexam_target: string | null;
  bizrno: string | null;
  ee_doc_id: string | null;
  ud_doc_id: string | null;
  nb_doc_id: string | null;
  insert_file: string | null;
  synced_at: string;
}

/** Row from mfds_devices table (의료기기 UDI) */
export interface MfdsDevice {
  id: number;
  udidi_cd: string;
  prdlst_nm: string;
  prdt_nm_info: string | null;
  mnft_iprt_entp_nm: string | null;
  permit_no: string | null;
  prmsn_ymd: string | null;
  mdeq_clsf_no: string | null;
  clsf_no_grad_cd: string | null;
  foml_info: string | null;
  use_purps_cont: string | null;
  hmbd_trspt_mdeq_yn: string | null;
  dspsbl_mdeq_yn: string | null;
  trck_mng_trgt_yn: string | null;
  rcprslry_trgt_yn: string | null;
  total_dev: string | null;
  cmbnmd_yn: string | null;
  use_before_strlzt_need_yn: string | null;
  sterilization_method_nm: string | null;
  strg_cnd_info: string | null;
  circ_cnd_info: string | null;
  synced_at: string;
}

/** Union type for search results */
export type MfdsItem = (MfdsDrug & { _type: "drug" }) | (MfdsDevice & { _type: "device_std" });
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add MfdsDrug and MfdsDevice types, replace MfdsItem"
```

---

### Task 3: Update sync engine (mfds-sync.ts)

**Files:**
- Modify: `apps/web/src/lib/mfds-sync.ts`

The sync engine must map API response fields to the correct table columns per source type, and upsert to `mfds_drugs` or `mfds_devices` instead of `mfds_items`.

- [ ] **Step 1: Add table config and field mappings**

Replace the `ApiConfig` interface and `MFDS_API_CONFIGS` with expanded versions that include all field mappings:

```typescript
interface FieldMapping {
  apiField: string;
  dbColumn: string;
}

interface ApiConfig {
  url: string;
  tableName: string;
  uniqueColumn: string;
  sourceKeyField: string;
  itemNameField: string;
  manufacturerField: string;
  permitDateField: string;
  startDateParam: string;
  endDateParam: string;
  fieldMappings: FieldMapping[];
}

export const MFDS_API_CONFIGS: Record<string, ApiConfig> = {
  drug: {
    url: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    tableName: "mfds_drugs",
    uniqueColumn: "item_seq",
    sourceKeyField: "ITEM_SEQ",
    itemNameField: "ITEM_NAME",
    manufacturerField: "ENTP_NAME",
    permitDateField: "ITEM_PERMIT_DATE",
    startDateParam: "prmsn_dt_start",
    endDateParam: "prmsn_dt_end",
    fieldMappings: [
      { apiField: "ITEM_SEQ", dbColumn: "item_seq" },
      { apiField: "ITEM_NAME", dbColumn: "item_name" },
      { apiField: "ITEM_ENG_NAME", dbColumn: "item_eng_name" },
      { apiField: "ENTP_NAME", dbColumn: "entp_name" },
      { apiField: "ENTP_ENG_NAME", dbColumn: "entp_eng_name" },
      { apiField: "ENTP_NO", dbColumn: "entp_no" },
      { apiField: "ITEM_PERMIT_DATE", dbColumn: "item_permit_date" },
      { apiField: "CNSGN_MANUF", dbColumn: "cnsgn_manuf" },
      { apiField: "ETC_OTC_CODE", dbColumn: "etc_otc_code" },
      { apiField: "CHART", dbColumn: "chart" },
      { apiField: "BAR_CODE", dbColumn: "bar_code" },
      { apiField: "MATERIAL_NAME", dbColumn: "material_name" },
      { apiField: "STORAGE_METHOD", dbColumn: "storage_method" },
      { apiField: "VALID_TERM", dbColumn: "valid_term" },
      { apiField: "PACK_UNIT", dbColumn: "pack_unit" },
      { apiField: "EDI_CODE", dbColumn: "edi_code" },
      { apiField: "ATC_CODE", dbColumn: "atc_code" },
      { apiField: "MAIN_ITEM_INGR", dbColumn: "main_item_ingr" },
      { apiField: "MAIN_INGR_ENG", dbColumn: "main_ingr_eng" },
      { apiField: "INGR_NAME", dbColumn: "ingr_name" },
      { apiField: "TOTAL_CONTENT", dbColumn: "total_content" },
      { apiField: "PERMIT_KIND_NAME", dbColumn: "permit_kind_name" },
      { apiField: "MAKE_MATERIAL_FLAG", dbColumn: "make_material_flag" },
      { apiField: "NEWDRUG_CLASS_NAME", dbColumn: "newdrug_class_name" },
      { apiField: "INDUTY_TYPE", dbColumn: "induty_type" },
      { apiField: "CANCEL_DATE", dbColumn: "cancel_date" },
      { apiField: "CANCEL_NAME", dbColumn: "cancel_name" },
      { apiField: "CHANGE_DATE", dbColumn: "change_date" },
      { apiField: "GBN_NAME", dbColumn: "gbn_name" },
      { apiField: "NARCOTIC_KIND_CODE", dbColumn: "narcotic_kind_code" },
      { apiField: "RARE_DRUG_YN", dbColumn: "rare_drug_yn" },
      { apiField: "REEXAM_DATE", dbColumn: "reexam_date" },
      { apiField: "REEXAM_TARGET", dbColumn: "reexam_target" },
      { apiField: "BIZRNO", dbColumn: "bizrno" },
      { apiField: "EE_DOC_ID", dbColumn: "ee_doc_id" },
      { apiField: "UD_DOC_ID", dbColumn: "ud_doc_id" },
      { apiField: "NB_DOC_ID", dbColumn: "nb_doc_id" },
      { apiField: "INSERT_FILE", dbColumn: "insert_file" },
    ],
  },
  device_std: {
    url: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    tableName: "mfds_devices",
    uniqueColumn: "udidi_cd",
    sourceKeyField: "UDIDI_CD",
    itemNameField: "PRDLST_NM",
    manufacturerField: "MNFT_IPRT_ENTP_NM",
    permitDateField: "PRMSN_YMD",
    startDateParam: "prmsn_ymd_start",
    endDateParam: "prmsn_ymd_end",
    fieldMappings: [
      { apiField: "UDIDI_CD", dbColumn: "udidi_cd" },
      { apiField: "PRDLST_NM", dbColumn: "prdlst_nm" },
      { apiField: "PRDT_NM_INFO", dbColumn: "prdt_nm_info" },
      { apiField: "MNFT_IPRT_ENTP_NM", dbColumn: "mnft_iprt_entp_nm" },
      { apiField: "PERMIT_NO", dbColumn: "permit_no" },
      { apiField: "PRMSN_YMD", dbColumn: "prmsn_ymd" },
      { apiField: "MDEQ_CLSF_NO", dbColumn: "mdeq_clsf_no" },
      { apiField: "CLSF_NO_GRAD_CD", dbColumn: "clsf_no_grad_cd" },
      { apiField: "FOML_INFO", dbColumn: "foml_info" },
      { apiField: "USE_PURPS_CONT", dbColumn: "use_purps_cont" },
      { apiField: "HMBD_TRSPT_MDEQ_YN", dbColumn: "hmbd_trspt_mdeq_yn" },
      { apiField: "DSPSBL_MDEQ_YN", dbColumn: "dspsbl_mdeq_yn" },
      { apiField: "TRCK_MNG_TRGT_YN", dbColumn: "trck_mng_trgt_yn" },
      { apiField: "RCPRSLRY_TRGT_YN", dbColumn: "rcprslry_trgt_yn" },
      { apiField: "TOTAL_DEV", dbColumn: "total_dev" },
      { apiField: "CMBNMD_YN", dbColumn: "cmbnmd_yn" },
      { apiField: "USE_BEFORE_STRLZT_NEED_YN", dbColumn: "use_before_strlzt_need_yn" },
      { apiField: "STERILIZATION_METHOD_NM", dbColumn: "sterilization_method_nm" },
      { apiField: "STRG_CND_INFO", dbColumn: "strg_cnd_info" },
      { apiField: "CIRC_CND_INFO", dbColumn: "circ_cnd_info" },
    ],
  },
};
```

- [ ] **Step 2: Update the transform + upsert logic in runSync**

Replace the transform/upsert block (the `apiRows` building + upsert to `mfds_items`) with:

```typescript
// Transform API items → DB rows using field mappings
const seen = new Set<string>();
const toUpsert: Record<string, unknown>[] = [];
for (const item of items) {
  const key = String(item[config.sourceKeyField] || "");
  if (!key || seen.has(key)) continue;
  seen.add(key);
  const row: Record<string, unknown> = { synced_at: now };
  for (const { apiField, dbColumn } of config.fieldMappings) {
    const val = item[apiField];
    row[dbColumn] = val != null ? String(val) : null;
  }
  toUpsert.push(row);
}

if (toUpsert.length > 0) {
  const { count, error } = await admin
    .from(config.tableName)
    .upsert(toUpsert, { onConflict: config.uniqueColumn, count: "exact" });
  if (error) {
    console.error(`[Sync] Upsert error page ${page}:`, error.message);
  } else {
    totalUpserted += count || toUpsert.length;
  }
}
```

- [ ] **Step 3: Update the local count query in the completion block**

Change the `mfds_items` count query to use the correct table:

```typescript
const { count: localCount } = await admin
  .from(config.tableName)
  .select("id", { count: "exact", head: true });
```

- [ ] **Step 4: Update detectSyncMode to use the correct table**

```typescript
const { count: localCount } = await admin
  .from(config.tableName)
  .select("id", { count: "exact", head: true });
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/mfds-sync.ts
git commit -m "feat: update sync engine to write to mfds_drugs/mfds_devices tables"
```

---

### Task 4: Update search and actions (actions.ts)

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

- [ ] **Step 1: Update searchMfdsItems**

Replace the `searchMfdsItems` function to query the correct table and remove `raw_data` usage:

```typescript
export async function searchMfdsItems(params: any) {
  const { query, sourceType, page = 1, pageSize = 30, filters = [], sortBy, sortOrder = "asc" } = params;
  const supabase = await createClient();
  const q = query.trim();
  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  const tableName = sourceType === "drug" ? "mfds_drugs" : "mfds_devices";
  const nameCol = sourceType === "drug" ? "item_name" : "prdlst_nm";
  const mfrCol = sourceType === "drug" ? "entp_name" : "mnft_iprt_entp_nm";
  const codeCol = sourceType === "drug" ? "bar_code" : "udidi_cd";

  let dbQuery = supabase.from(tableName).select("*", { count: "exact" });

  if (q) dbQuery = dbQuery.or(`${nameCol}.ilike.%${q}%,${mfrCol}.ilike.%${q}%,${codeCol}.ilike.%${q}%`);
  for (const chip of filters) dbQuery = dbQuery.filter(chip.field.toLowerCase(), "ilike", `%${chip.value}%`);
  dbQuery = dbQuery.order(nameCol, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, count, error } = await dbQuery;
  if (error) throw error;

  // Add _type for UI to distinguish
  const items = (data ?? []).map((row: any) => ({
    ...row,
    _type: sourceType,
  }));
  return { items, totalCount: count ?? 0, page };
}
```

- [ ] **Step 2: Update getMfdsSyncStatus**

Replace `mfds_items` count queries with the new tables:

```typescript
export async function getMfdsSyncStatus() {
  const supabase = await createClient();
  const [l, metaDrug, metaDevice, drugCount, deviceCount, logDrug, logDevice] = await Promise.all([
    supabase.from("mfds_sync_logs").select("finished_at").eq("status", "completed").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("mfds_sync_meta").select("*").eq("source_type", "drug").maybeSingle(),
    supabase.from("mfds_sync_meta").select("*").eq("source_type", "device_std").maybeSingle(),
    supabase.from("mfds_drugs").select("id", { count: "exact", head: true }),
    supabase.from("mfds_devices").select("id", { count: "exact", head: true }),
    supabase.from("mfds_sync_logs").select("api_total_count").eq("source_type", "drug").not("api_total_count", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("mfds_sync_logs").select("api_total_count").eq("source_type", "device_std").not("api_total_count", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    lastSync: l.data?.finished_at ?? null,
    drugCount: drugCount.count ?? 0,
    drugApiCount: metaDrug.data?.api_total_count ?? logDrug.data?.api_total_count ?? null,
    deviceCount: deviceCount.count ?? 0,
    deviceApiCount: metaDevice.data?.api_total_count ?? logDevice.data?.api_total_count ?? null,
    meta: { drug: metaDrug.data ?? null, device_std: metaDevice.data ?? null },
  };
}
```

- [ ] **Step 3: Update addToMyDrugs — remove raw_data dependency**

The `addToMyDrugs` function currently reads from `item[KEY]` where item was `raw_data`. Now items come with direct columns (lowercase). Update the key mapping:

```typescript
export async function addToMyDrugs(item: Record<string, unknown>): Promise<{ success: boolean; id?: number; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const barCode = (item.bar_code as string) ?? (item.BAR_CODE as string) ?? null;
  if (barCode) {
    const { data: existing } = await supabase.from("my_drugs").select("id").eq("bar_code", barCode).maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }
  const row: any = {};
  // Map from mfds_drugs columns (lowercase) to my_drugs columns (also lowercase)
  const mapping: Record<string, string> = {
    item_seq: "item_seq", item_name: "item_name", item_eng_name: "item_eng_name",
    entp_name: "entp_name", entp_no: "entp_no", item_permit_date: "item_permit_date",
    cnsgn_manuf: "cnsgn_manuf", etc_otc_code: "etc_otc_code", chart: "chart",
    bar_code: "bar_code", material_name: "material_name", ee_doc_id: "ee_doc_id",
    ud_doc_id: "ud_doc_id", nb_doc_id: "nb_doc_id", storage_method: "storage_method",
    valid_term: "valid_term", pack_unit: "pack_unit", edi_code: "edi_code",
    permit_kind_name: "permit_kind_name", cancel_date: "cancel_date",
    cancel_name: "cancel_name", change_date: "change_date", atc_code: "atc_code",
    rare_drug_yn: "rare_drug_yn",
  };
  for (const [src, dst] of Object.entries(mapping)) {
    row[dst] = (item[src] as string) ?? null;
  }
  const { data, error } = await supabase.from("my_drugs").insert(row).select("id").single();
  if (error) { console.error("addToMyDrugs error:", error); return { success: false }; }
  revalidatePath("/products"); return { success: true, id: data.id };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat: update search and actions to use mfds_drugs/mfds_devices tables"
```

---

### Task 5: Update UI components

**Files:**
- Modify: `apps/web/src/components/drug-search-dialog.tsx`
- Modify: `apps/web/src/components/mfds-search-panel.tsx`
- Modify: `apps/web/src/app/api/sync-mfds/status/route.ts`
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts`

- [ ] **Step 1: Update drug-search-dialog.tsx — remove rd() helper**

The `rd()` function reads from `item.raw_data`. Now fields are direct columns. Replace `rd(item, "FIELD")` with `item.field_name` (lowercase). Remove the `rd()` function entirely and update all usages:

- `rd(item, "EDI_CODE")` → `item.edi_code`
- `rd(item, "MAIN_ITEM_INGR")` → `item.main_item_ingr`
- `rd(item, "RARE_DRUG_YN")` → `item.rare_drug_yn`
- `rd(item, "USE_PURPS_CONT")` → `item.use_purps_cont` (for devices)
- `rd(item, "FOML_INFO")` → `item.foml_info`
- `rd(item, "PRDT_NM_INFO")` → `item.prdt_nm_info`
- `rd(item, "PERMIT_NO")` → `item.permit_no`
- `rd(item, "CLSF_NO_GRAD_CD")` → `item.clsf_no_grad_cd`
- `rd(item, "HMBD_TRSPT_MDEQ_YN")` → `item.hmbd_trspt_mdeq_yn`
- `rd(item, "DSPSBL_MDEQ_YN")` → `item.dspsbl_mdeq_yn`
- `rd(item, "RCPRSLRY_TRGT_YN")` → `item.rcprslry_trgt_yn`
- `rd(item, "TRCK_MNG_TRGT_YN")` → `item.trck_mng_trgt_yn`
- `rd(item, "STERILIZATION_METHOD_NM")` → `item.sterilization_method_nm`
- `rd(item, "STRG_CND_INFO")` → `item.strg_cnd_info`
- `rd(item, "CIRC_CND_INFO")` → `item.circ_cnd_info`
- `rd(item, "MEDDEV_ITEM_NO")` → `item.permit_no`

Also update `mfdsItemToFill()` to use direct columns:
```typescript
function mfdsItemToFill(item: any): MedicalProductFill {
  if (item._type === "drug" || item.item_seq) {
    return {
      official_name: item.item_name,
      manufacturer: item.entp_name,
      ingredient: item.main_item_ingr ?? item.use_purps_cont ?? null,
      standard_code: item.bar_code,
      mfds_item_id: item.id,
    };
  }
  return {
    official_name: item.prdlst_nm,
    manufacturer: item.mnft_iprt_entp_nm,
    ingredient: item.use_purps_cont ?? null,
    standard_code: item.udidi_cd,
    mfds_item_id: item.id,
  };
}
```

- [ ] **Step 2: Update mfds-search-panel.tsx**

The search panel uses `item.item_name`, `item.manufacturer`, `item.standard_code` from old `MfdsItem`. Now:
- Drug: `item_name`, `entp_name`, `bar_code`
- Device: `prdlst_nm`, `mnft_iprt_entp_nm`, `udidi_cd`

The `MfdsResultTable` and column definitions need to handle both types. Since the search panel receives items from `searchMfdsItems` which adds `_type`, update the column accessors accordingly. The exact changes depend on how `MfdsResultTable` is structured — read and update the column definitions.

- [ ] **Step 3: Update sync-mfds/status/route.ts**

Replace `mfds_items` count queries:

```typescript
const [drug, device] = await Promise.all([
  admin.from("mfds_drugs").select("id", { count: "exact", head: true }),
  admin.from("mfds_devices").select("id", { count: "exact", head: true }),
]);
```

- [ ] **Step 4: Update orders/actions.ts — searchMfdsItemsAction**

Replace `mfds_items` query with a union approach or two queries:

```typescript
export async function searchMfdsItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const q = query.trim();

  const [drugs, devices] = await Promise.all([
    supabase.from("mfds_drugs")
      .select("id, item_name, bar_code, entp_name")
      .or(`item_name.ilike.%${q}%,bar_code.ilike.%${q}%,entp_name.ilike.%${q}%`)
      .limit(15),
    supabase.from("mfds_devices")
      .select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm")
      .or(`prdlst_nm.ilike.%${q}%,udidi_cd.ilike.%${q}%,mnft_iprt_entp_nm.ilike.%${q}%`)
      .limit(15),
  ]);

  const results = [
    ...(drugs.data ?? []).map((d) => ({
      id: d.id, name: d.item_name, code: d.bar_code ?? "", source_type: "drug" as const, manufacturer: d.entp_name,
    })),
    ...(devices.data ?? []).map((d) => ({
      id: d.id, name: d.prdlst_nm, code: d.udidi_cd ?? "", source_type: "device_std" as const, manufacturer: d.mnft_iprt_entp_nm,
    })),
  ];
  return results.slice(0, 30);
}
```

- [ ] **Step 5: Build check**

Run: `npm run build:web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/drug-search-dialog.tsx \
  apps/web/src/components/mfds-search-panel.tsx \
  apps/web/src/app/api/sync-mfds/status/route.ts \
  apps/web/src/app/(dashboard)/orders/actions.ts
git commit -m "feat: update all UI and API routes to use split mfds tables"
```

---

## Task Dependency Order

```
Task 1 (migration) — must be first
Task 2 (types) — after Task 1
Task 3 (sync engine) — after Task 2
Task 4 (actions) — after Task 2
Task 5 (UI + routes) — after Task 3 and 4
```

Tasks 3 and 4 can run in parallel after Task 2.
