-- 00049_hospitals_invoice_fields.sql
-- Add tax invoice required fields to hospitals table

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ceo_name VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS biz_type VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS biz_item VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS email VARCHAR(200);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS fax VARCHAR(20);

COMMENT ON COLUMN hospitals.ceo_name IS '대표자명 (세금계산서용)';
COMMENT ON COLUMN hospitals.biz_type IS '업태 (세금계산서용)';
COMMENT ON COLUMN hospitals.biz_item IS '종목 (세금계산서용)';
COMMENT ON COLUMN hospitals.email IS '세금계산서 수신 이메일';
COMMENT ON COLUMN hospitals.fax IS '팩스번호';
