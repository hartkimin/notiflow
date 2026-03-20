-- 00057_invoice_items_purchase_price.sql
-- Add purchase_price to tax_invoice_items for profit tracking

ALTER TABLE tax_invoice_items ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2);
