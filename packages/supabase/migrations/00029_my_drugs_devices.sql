-- 00029_my_drugs_devices.sql
-- Replaces: products, product_aliases → my_drugs, my_devices

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

CREATE VIEW products_catalog AS
  SELECT
    id,
    item_name AS name,
    item_name AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    bar_code AS standard_code,
    'drug' AS source_type
  FROM my_drugs
UNION ALL
  SELECT
    1000000 + id,
    prdlst_nm AS name,
    prdlst_nm AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    udidi_cd AS standard_code,
    'device_std' AS source_type
  FROM my_devices;

-- ═══ 4. Drop old tables ═══

DROP TABLE IF EXISTS product_aliases CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- ═══ 5. Enable RLS ═══

ALTER TABLE my_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_my_drugs" ON my_drugs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_my_drugs" ON my_drugs FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read_my_devices" ON my_devices FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_my_devices" ON my_devices FOR ALL TO authenticated USING (true);
