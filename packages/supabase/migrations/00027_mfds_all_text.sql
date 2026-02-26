-- ============================================================
-- 27. Convert ALL mfds_items VARCHAR columns to TEXT
-- MFDS API data lengths are completely unpredictable.
-- TEXT has identical performance to VARCHAR in PostgreSQL.
-- ============================================================

ALTER TABLE mfds_items ALTER COLUMN source_key TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN item_name TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN manufacturer TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN permit_no TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN permit_date TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN standard_code TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN classification_no TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN classification_grade TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN product_name TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN rare_drug_yn TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN hmbd_trspt_mdeq_yn TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN dspsbl_mdeq_yn TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN trck_mng_trgt_yn TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN total_dev TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN cmbnmd_yn TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN use_before_strlzt_need_yn TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN rcprslry_trgt_yn TYPE TEXT;
