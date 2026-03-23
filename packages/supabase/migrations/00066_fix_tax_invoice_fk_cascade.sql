-- 00066_fix_tax_invoice_fk_cascade.sql
-- Fix missing ON DELETE CASCADE/SET NULL for tax_invoice_items and tax_invoice_orders
-- These FK constraints block order deletion when tax invoices reference the order

-- ─── 1. tax_invoice_items.order_id → ON DELETE SET NULL ──────────────
-- (order_id is nullable, so SET NULL is appropriate — preserves invoice history)
ALTER TABLE tax_invoice_items
  DROP CONSTRAINT IF EXISTS tax_invoice_items_order_id_fkey;

ALTER TABLE tax_invoice_items
  ADD CONSTRAINT tax_invoice_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ─── 2. tax_invoice_items.order_item_id → ON DELETE SET NULL ─────────
ALTER TABLE tax_invoice_items
  DROP CONSTRAINT IF EXISTS tax_invoice_items_order_item_id_fkey;

ALTER TABLE tax_invoice_items
  ADD CONSTRAINT tax_invoice_items_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;

-- ─── 3. tax_invoice_orders.order_id → ON DELETE CASCADE ──────────────
-- (this is a mapping table — if order is deleted, mapping should go too)
ALTER TABLE tax_invoice_orders
  DROP CONSTRAINT IF EXISTS tax_invoice_orders_order_id_fkey;

ALTER TABLE tax_invoice_orders
  ADD CONSTRAINT tax_invoice_orders_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
