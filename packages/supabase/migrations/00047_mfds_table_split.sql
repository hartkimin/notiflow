-- 00047_mfds_table_split.sql
-- Split mfds_items into mfds_drugs (의약품) and mfds_devices (의료기기 UDI) tables
-- mfds_items is preserved; a compatibility view mfds_items_view is created over both new tables

-- ============================================================
-- 1. Table: mfds_drugs (의약품)
--    UNIQUE on item_seq (품목기준코드 = ITEM_SEQ)
-- ============================================================
CREATE TABLE IF NOT EXISTS mfds_drugs (
  id                    BIGSERIAL PRIMARY KEY,

  -- 품목기준코드 (primary key from MFDS drug API)
  item_seq              TEXT NOT NULL UNIQUE,

  -- 품목명
  item_name             TEXT NOT NULL,

  -- 영문 품목명
  item_eng_name         TEXT,

  -- 업체명 (Korean)
  entp_name             TEXT,

  -- 업체명 (English)
  entp_eng_name         TEXT,

  -- 업체허가번호
  entp_no               TEXT,

  -- 허가일자
  item_permit_date      TEXT,

  -- 위탁제조업체
  cnsgn_manuf           TEXT,

  -- 전문/일반 구분 (ETC_OTC_CODE)
  etc_otc_code          TEXT,

  -- 성상 (외형)
  chart                 TEXT,

  -- 바코드
  bar_code              TEXT,

  -- 원료성분명
  material_name         TEXT,

  -- 저장방법
  storage_method        TEXT,

  -- 유효기간
  valid_term            TEXT,

  -- 포장단위
  pack_unit             TEXT,

  -- 보험코드 (EDI)
  edi_code              TEXT,

  -- ATC 코드
  atc_code              TEXT,

  -- 주성분명 (Korean)
  main_item_ingr        TEXT,

  -- 주성분명 (English)
  main_ingr_eng         TEXT,

  -- 성분명
  ingr_name             TEXT,

  -- 총량
  total_content         TEXT,

  -- 허가종류명
  permit_kind_name      TEXT,

  -- 원료의약품 여부
  make_material_flag    TEXT,

  -- 신약 분류명
  newdrug_class_name    TEXT,

  -- 업종 구분
  induty_type           TEXT,

  -- 취소일자
  cancel_date           TEXT,

  -- 취소명
  cancel_name           TEXT,

  -- 변경일자
  change_date           TEXT,

  -- 구분명 (제조/수입)
  gbn_name              TEXT,

  -- 마약류 구분코드
  narcotic_kind_code    TEXT,

  -- 희귀의약품 여부
  rare_drug_yn          TEXT,

  -- 재심사 기간
  reexam_date           TEXT,

  -- 재심사 대상
  reexam_target         TEXT,

  -- 사업자등록번호
  bizrno                TEXT,

  -- 효능·효과 문서 ID
  ee_doc_id             TEXT,

  -- 용법·용량 문서 ID
  ud_doc_id             TEXT,

  -- 사용상주의사항 문서 ID
  nb_doc_id             TEXT,

  -- 첨부문서 (PDF 등)
  insert_file           TEXT,

  -- Sync metadata
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Indexes: mfds_drugs ----

-- Full-text trigram search on item_name
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_item_name_trgm
  ON mfds_drugs USING gin (item_name gin_trgm_ops);

-- Full-text trigram search on entp_name
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_entp_name_trgm
  ON mfds_drugs USING gin (entp_name gin_trgm_ops)
  WHERE entp_name IS NOT NULL;

-- Bar code lookup
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_bar_code
  ON mfds_drugs (bar_code)
  WHERE bar_code IS NOT NULL;

-- EDI code lookup
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_edi_code
  ON mfds_drugs (edi_code)
  WHERE edi_code IS NOT NULL;

-- ATC code lookup
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_atc_code
  ON mfds_drugs (atc_code)
  WHERE atc_code IS NOT NULL;

-- Permit date range queries
CREATE INDEX IF NOT EXISTS idx_mfds_drugs_item_permit_date
  ON mfds_drugs (item_permit_date)
  WHERE item_permit_date IS NOT NULL;

-- ---- Trigger: auto-update updated_at ----
DROP TRIGGER IF EXISTS update_mfds_drugs_updated_at ON mfds_drugs;
CREATE TRIGGER update_mfds_drugs_updated_at
  BEFORE UPDATE ON mfds_drugs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS: mfds_drugs ----
ALTER TABLE mfds_drugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select mfds_drugs"
  ON mfds_drugs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage mfds_drugs"
  ON mfds_drugs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 2. Table: mfds_devices (의료기기 UDI)
--    UNIQUE on udidi_cd (UDI-DI code)
-- ============================================================
CREATE TABLE IF NOT EXISTS mfds_devices (
  id                        BIGSERIAL PRIMARY KEY,

  -- UDI-DI 코드 (primary key from MFDS UDI device API)
  udidi_cd                  TEXT NOT NULL UNIQUE,

  -- 품목명
  prdlst_nm                 TEXT NOT NULL,

  -- 모델명 (제품명 상세)
  prdt_nm_info              TEXT,

  -- 업체명 (제조/수입)
  mnft_iprt_entp_nm         TEXT,

  -- 허가번호
  permit_no                 TEXT,

  -- 허가일자 (YYYYMMDD)
  prmsn_ymd                 TEXT,

  -- 의료기기 분류번호
  mdeq_clsf_no              TEXT,

  -- 분류등급코드
  clsf_no_grad_cd           TEXT,

  -- 형태정보 (제형)
  foml_info                 TEXT,

  -- 사용목적
  use_purps_cont            TEXT,

  -- 인체이식 여부
  hmbd_trspt_mdeq_yn        TEXT,

  -- 일회용 여부
  dspsbl_mdeq_yn            TEXT,

  -- 추적관리대상 여부
  trck_mng_trgt_yn          TEXT,

  -- 호흡보조장치 여부
  rcprslry_trgt_yn          TEXT,

  -- 총 장비 수
  total_dev                 TEXT,

  -- 복합의료기기 여부
  cmbnmd_yn                 TEXT,

  -- 멸균 전 사용필요 여부
  use_before_strlzt_need_yn TEXT,

  -- 멸균방법명
  sterilization_method_nm   TEXT,

  -- 보관조건 정보
  strg_cnd_info             TEXT,

  -- 유통조건 정보
  circ_cnd_info             TEXT,

  -- Sync metadata
  synced_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Indexes: mfds_devices ----

-- Full-text trigram search on prdlst_nm
CREATE INDEX IF NOT EXISTS idx_mfds_devices_prdlst_nm_trgm
  ON mfds_devices USING gin (prdlst_nm gin_trgm_ops);

-- Full-text trigram search on mnft_iprt_entp_nm
CREATE INDEX IF NOT EXISTS idx_mfds_devices_entp_nm_trgm
  ON mfds_devices USING gin (mnft_iprt_entp_nm gin_trgm_ops)
  WHERE mnft_iprt_entp_nm IS NOT NULL;

-- Permit number lookup
CREATE INDEX IF NOT EXISTS idx_mfds_devices_permit_no
  ON mfds_devices (permit_no)
  WHERE permit_no IS NOT NULL;

-- Classification number lookup
CREATE INDEX IF NOT EXISTS idx_mfds_devices_mdeq_clsf_no
  ON mfds_devices (mdeq_clsf_no)
  WHERE mdeq_clsf_no IS NOT NULL;

-- Permit date range queries
CREATE INDEX IF NOT EXISTS idx_mfds_devices_prmsn_ymd
  ON mfds_devices (prmsn_ymd)
  WHERE prmsn_ymd IS NOT NULL;

-- ---- Trigger: auto-update updated_at ----
DROP TRIGGER IF EXISTS update_mfds_devices_updated_at ON mfds_devices;
CREATE TRIGGER update_mfds_devices_updated_at
  BEFORE UPDATE ON mfds_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS: mfds_devices ----
ALTER TABLE mfds_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select mfds_devices"
  ON mfds_devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage mfds_devices"
  ON mfds_devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 3. Data migration from mfds_items
--    Populate mfds_drugs from source_type = 'drug'
--    Populate mfds_devices from source_type = 'device_std'
-- ============================================================

-- 3a. Migrate drug rows
INSERT INTO mfds_drugs (
  item_seq,
  item_name,
  item_eng_name,
  entp_name,
  entp_eng_name,
  entp_no,
  item_permit_date,
  cnsgn_manuf,
  etc_otc_code,
  chart,
  bar_code,
  material_name,
  storage_method,
  valid_term,
  pack_unit,
  edi_code,
  atc_code,
  main_item_ingr,
  main_ingr_eng,
  ingr_name,
  total_content,
  permit_kind_name,
  make_material_flag,
  newdrug_class_name,
  induty_type,
  cancel_date,
  cancel_name,
  change_date,
  gbn_name,
  narcotic_kind_code,
  rare_drug_yn,
  reexam_date,
  reexam_target,
  bizrno,
  ee_doc_id,
  ud_doc_id,
  nb_doc_id,
  insert_file,
  synced_at,
  created_at,
  updated_at
)
SELECT
  source_key                              AS item_seq,
  item_name,
  raw_data->>'ITEM_ENG_NAME'             AS item_eng_name,
  COALESCE(manufacturer, raw_data->>'ENTP_NAME') AS entp_name,
  raw_data->>'ENTP_ENG_NAME'             AS entp_eng_name,
  raw_data->>'ENTP_NO'                   AS entp_no,
  COALESCE(permit_date, raw_data->>'ITEM_PERMIT_DATE') AS item_permit_date,
  raw_data->>'CNSGN_MANUF'              AS cnsgn_manuf,
  raw_data->>'ETC_OTC_CODE'             AS etc_otc_code,
  raw_data->>'CHART'                    AS chart,
  COALESCE(standard_code, raw_data->>'BAR_CODE') AS bar_code,
  raw_data->>'MATERIAL_NAME'            AS material_name,
  raw_data->>'STORAGE_METHOD'           AS storage_method,
  raw_data->>'VALID_TERM'               AS valid_term,
  raw_data->>'PACK_UNIT'                AS pack_unit,
  raw_data->>'EDI_CODE'                 AS edi_code,
  raw_data->>'ATC_CODE'                 AS atc_code,
  raw_data->>'MAIN_ITEM_INGR'           AS main_item_ingr,
  raw_data->>'MAIN_INGR_ENG'            AS main_ingr_eng,
  raw_data->>'INGR_NAME'                AS ingr_name,
  raw_data->>'TOTAL_CONTENT'            AS total_content,
  raw_data->>'PERMIT_KIND_NAME'         AS permit_kind_name,
  raw_data->>'MAKE_MATERIAL_FLAG'       AS make_material_flag,
  raw_data->>'NEWDRUG_CLASS_NAME'       AS newdrug_class_name,
  raw_data->>'INDUTY_TYPE'              AS induty_type,
  raw_data->>'CANCEL_DATE'              AS cancel_date,
  raw_data->>'CANCEL_NAME'              AS cancel_name,
  raw_data->>'CHANGE_DATE'              AS change_date,
  raw_data->>'GBN_NAME'                 AS gbn_name,
  raw_data->>'NARCOTIC_KIND_CODE'       AS narcotic_kind_code,
  raw_data->>'RARE_DRUG_YN'             AS rare_drug_yn,
  raw_data->>'REEXAM_DATE'              AS reexam_date,
  raw_data->>'REEXAM_TARGET'            AS reexam_target,
  raw_data->>'BIZRNO'                   AS bizrno,
  raw_data->>'EE_DOC_ID'               AS ee_doc_id,
  raw_data->>'UD_DOC_ID'               AS ud_doc_id,
  raw_data->>'NB_DOC_ID'               AS nb_doc_id,
  raw_data->>'INSERT_FILE'              AS insert_file,
  COALESCE(synced_at, created_at),
  created_at,
  updated_at
FROM mfds_items
WHERE source_type = 'drug'
ON CONFLICT (item_seq) DO NOTHING;

-- 3b. Migrate device_std rows
INSERT INTO mfds_devices (
  udidi_cd,
  prdlst_nm,
  prdt_nm_info,
  mnft_iprt_entp_nm,
  permit_no,
  prmsn_ymd,
  mdeq_clsf_no,
  clsf_no_grad_cd,
  foml_info,
  use_purps_cont,
  hmbd_trspt_mdeq_yn,
  dspsbl_mdeq_yn,
  trck_mng_trgt_yn,
  rcprslry_trgt_yn,
  total_dev,
  cmbnmd_yn,
  use_before_strlzt_need_yn,
  sterilization_method_nm,
  strg_cnd_info,
  circ_cnd_info,
  synced_at,
  created_at,
  updated_at
)
SELECT
  source_key                                        AS udidi_cd,
  item_name                                         AS prdlst_nm,
  COALESCE(raw_data->>'PRDT_NM_INFO', raw_data->>'prdt_nm_info') AS prdt_nm_info,
  COALESCE(manufacturer, raw_data->>'MNFT_IPRT_ENTP_NM', raw_data->>'mnft_iprt_entp_nm') AS mnft_iprt_entp_nm,
  COALESCE(raw_data->>'PERMIT_NO',    raw_data->>'permit_no')    AS permit_no,
  COALESCE(raw_data->>'PRMSN_YMD',   raw_data->>'prmsn_ymd', permit_date) AS prmsn_ymd,
  COALESCE(raw_data->>'MDEQ_CLSF_NO', raw_data->>'mdeq_clsf_no') AS mdeq_clsf_no,
  COALESCE(raw_data->>'CLSF_NO_GRAD_CD', raw_data->>'clsf_no_grad_cd') AS clsf_no_grad_cd,
  COALESCE(raw_data->>'FOML_INFO',   raw_data->>'foml_info')    AS foml_info,
  COALESCE(raw_data->>'USE_PURPS_CONT', raw_data->>'use_purps_cont') AS use_purps_cont,
  COALESCE(raw_data->>'HMBD_TRSPT_MDEQ_YN', raw_data->>'hmbd_trspt_mdeq_yn') AS hmbd_trspt_mdeq_yn,
  COALESCE(raw_data->>'DSPSBL_MDEQ_YN', raw_data->>'dspsbl_mdeq_yn') AS dspsbl_mdeq_yn,
  COALESCE(raw_data->>'TRCK_MNG_TRGT_YN', raw_data->>'trck_mng_trgt_yn') AS trck_mng_trgt_yn,
  COALESCE(raw_data->>'RCPRSLRY_TRGT_YN', raw_data->>'rcprslry_trgt_yn') AS rcprslry_trgt_yn,
  COALESCE(raw_data->>'TOTAL_DEV',   raw_data->>'total_dev')    AS total_dev,
  COALESCE(raw_data->>'CMBNMD_YN',   raw_data->>'cmbnmd_yn')    AS cmbnmd_yn,
  COALESCE(raw_data->>'USE_BEFORE_STRLZT_NEED_YN', raw_data->>'use_before_strlzt_need_yn') AS use_before_strlzt_need_yn,
  COALESCE(raw_data->>'STERILIZATION_METHOD_NM', raw_data->>'sterilization_method_nm') AS sterilization_method_nm,
  COALESCE(raw_data->>'STRG_CND_INFO', raw_data->>'strg_cnd_info') AS strg_cnd_info,
  COALESCE(raw_data->>'CIRC_CND_INFO', raw_data->>'circ_cnd_info') AS circ_cnd_info,
  COALESCE(synced_at, created_at),
  created_at,
  updated_at
FROM mfds_items
WHERE source_type = 'device_std'
ON CONFLICT (udidi_cd) DO NOTHING;


-- ============================================================
-- 4. Compatibility view: mfds_items_view
--    UNION ALL of mfds_drugs and mfds_devices exposing the
--    same common columns that code previously read from mfds_items
-- ============================================================
CREATE OR REPLACE VIEW mfds_items_view AS
  -- Drug rows
  SELECT
    id,
    'drug'::TEXT           AS source_type,
    item_seq               AS source_key,
    item_name,
    entp_name              AS manufacturer,
    bar_code               AS standard_code,
    item_permit_date       AS permit_date,
    synced_at
  FROM mfds_drugs

  UNION ALL

  -- Device rows
  SELECT
    id,
    'device_std'::TEXT     AS source_type,
    udidi_cd               AS source_key,
    prdlst_nm              AS item_name,
    mnft_iprt_entp_nm      AS manufacturer,
    udidi_cd               AS standard_code,
    prmsn_ymd              AS permit_date,
    synced_at
  FROM mfds_devices;
