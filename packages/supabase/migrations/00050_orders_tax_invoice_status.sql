-- 00050_orders_tax_invoice_status.sql
-- Add tax invoice status tracking to orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_invoice_status VARCHAR(20) DEFAULT 'pending';

COMMENT ON COLUMN orders.tax_invoice_status IS 'pending=미발행, partial=일부발행, issued=전체발행';
