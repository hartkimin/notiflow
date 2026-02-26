-- ============================================================
-- 25. Widen mfds_items columns that exceed original VARCHAR limits
-- BAR_CODE (drug) can be 250+ chars (comma-separated barcodes)
-- ============================================================

ALTER TABLE mfds_items ALTER COLUMN source_key TYPE VARCHAR(255);
ALTER TABLE mfds_items ALTER COLUMN standard_code TYPE VARCHAR(500);
ALTER TABLE mfds_items ALTER COLUMN permit_no TYPE VARCHAR(255);
ALTER TABLE mfds_items ALTER COLUMN classification_no TYPE VARCHAR(255);
