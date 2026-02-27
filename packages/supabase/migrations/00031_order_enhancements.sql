-- 00031_order_enhancements.sql
-- Add unit_price to my_drugs/my_devices and order number generation function

-- ═══ 1. Add price column to my_drugs ═══
ALTER TABLE my_drugs ADD COLUMN unit_price DECIMAL(12,2);

-- ═══ 2. Add price column to my_devices ═══
ALTER TABLE my_devices ADD COLUMN unit_price DECIMAL(12,2);

-- ═══ 3. Order number auto-generation function ═══
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := to_char(CURRENT_DATE, 'YYYYMMDD');
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM orders
  WHERE order_number LIKE 'ORD-' || today || '-%';

  RETURN 'ORD-' || today || '-' || lpad(seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ═══ 4. Default column display settings for orders ═══
INSERT INTO settings (key, value) VALUES
  ('order_display_columns', '{"drug": ["ITEM_NAME", "BAR_CODE", "ENTP_NAME", "EDI_CODE"], "device": ["PRDLST_NM", "UDIDI_CD", "MNFT_IPRT_ENTP_NM", "CLSF_NO_GRAD_CD"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
