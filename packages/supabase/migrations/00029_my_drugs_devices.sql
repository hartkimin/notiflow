-- 00029_my_drugs_devices.sql
-- Add my_drugs / my_devices tables alongside existing products table
-- products table is kept for order_items FK compatibility

-- ═══ 1. Create my_drugs (의약품 — 24 API columns + 2 meta) ═══

CREATE TABLE my_drugs (
  id SERIAL PRIMARY KEY,
  item_seq TEXT,
  item_name TEXT,
  item_eng_name TEXT,
  entp_name TEXT,
  entp_no TEXT,
  item_permit_date TEXT,
  cnsgn_manuf TEXT,
  etc_otc_code TEXT,
  chart TEXT,
  bar_code TEXT UNIQUE,
  material_name TEXT,
  ee_doc_id TEXT,
  ud_doc_id TEXT,
  nb_doc_id TEXT,
  storage_method TEXT,
  valid_term TEXT,
  pack_unit TEXT,
  edi_code TEXT,
  permit_kind_name TEXT,
  cancel_date TEXT,
  cancel_name TEXT,
  change_date TEXT,
  atc_code TEXT,
  rare_drug_yn TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ 2. Create my_devices (의료기기 — 20 API columns + 2 meta) ═══

CREATE TABLE my_devices (
  id SERIAL PRIMARY KEY,
  udidi_cd TEXT UNIQUE,
  prdlst_nm TEXT,
  mnft_iprt_entp_nm TEXT,
  mdeq_clsf_no TEXT,
  clsf_no_grad_cd TEXT,
  permit_no TEXT,
  prmsn_ymd TEXT,
  foml_info TEXT,
  prdt_nm_info TEXT,
  hmbd_trspt_mdeq_yn TEXT,
  dspsbl_mdeq_yn TEXT,
  trck_mng_trgt_yn TEXT,
  total_dev TEXT,
  cmbnmd_yn TEXT,
  use_before_strlzt_need_yn TEXT,
  sterilization_method_nm TEXT,
  use_purps_cont TEXT,
  strg_cnd_info TEXT,
  circ_cnd_info TEXT,
  rcprslry_trgt_yn TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ 3. Backward-compat VIEW for parse-service / parser ═══
-- Uses products table (kept) UNION my_drugs UNION my_devices
-- This ensures existing product IDs in order_items still resolve

CREATE OR REPLACE VIEW products_catalog AS
  SELECT
    id,
    name,
    official_name,
    short_name,
    is_active,
    standard_code,
    COALESCE(mfds_source_type, 'unknown') AS source_type
  FROM products
UNION ALL
  SELECT
    -1 * id AS id,
    item_name AS name,
    item_name AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    bar_code AS standard_code,
    'drug' AS source_type
  FROM my_drugs
  WHERE bar_code NOT IN (SELECT standard_code FROM products WHERE standard_code IS NOT NULL)
UNION ALL
  SELECT
    -1000000 - id AS id,
    prdlst_nm AS name,
    prdlst_nm AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    udidi_cd AS standard_code,
    'device_std' AS source_type
  FROM my_devices
  WHERE udidi_cd NOT IN (SELECT standard_code FROM products WHERE standard_code IS NOT NULL);

-- ═══ 4. Drop product_aliases (consumers removed) ═══

DROP TABLE IF EXISTS product_aliases CASCADE;

-- ═══ 5. Enable RLS ═══

ALTER TABLE my_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_my_drugs" ON my_drugs FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_my_drugs" ON my_drugs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "read_my_devices" ON my_devices FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_my_devices" ON my_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
