-- ============================================================
-- 26. Widen remaining mfds_items VARCHAR columns
-- MFDS API data lengths are unpredictable; switch small VARCHARs
-- to TEXT (identical perf in PostgreSQL) except Y/N flag fields.
-- ============================================================

-- Drug-specific: edi_code, atc_code can exceed original VARCHAR(50)
ALTER TABLE mfds_items ALTER COLUMN edi_code TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN atc_code TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN bizrno TYPE TEXT;

-- Device-specific
ALTER TABLE mfds_items ALTER COLUMN mnsc_nm TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN mnsc_natn_cd TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN prmsn_dclr_divs_nm TYPE TEXT;

-- Device_std-specific
ALTER TABLE mfds_items ALTER COLUMN foml_info TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN sterilization_method TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN strg_cnd_info TYPE TEXT;
ALTER TABLE mfds_items ALTER COLUMN circ_cnd_info TYPE TEXT;

-- Common: widen remaining VARCHAR columns that could overflow
ALTER TABLE mfds_items ALTER COLUMN classification_grade TYPE VARCHAR(50);
ALTER TABLE mfds_items ALTER COLUMN permit_date TYPE VARCHAR(50);
