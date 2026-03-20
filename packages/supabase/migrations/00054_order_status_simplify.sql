-- 00054_order_status_simplify.sql
-- Simplify order status: remove processing, add invoiced, drop tax_invoice_status

-- ═══ 1. Migrate existing data (while old enum still active) ═══

-- Move all processing → delivered
UPDATE orders SET status = 'delivered' WHERE status = 'processing';

-- Move delivered+fully-invoiced → invoiced (read tax_invoice_status before dropping it)
UPDATE orders SET status = 'invoiced'
WHERE status = 'delivered' AND tax_invoice_status = 'issued';

-- ═══ 2. Drop tax_invoice_status column (no longer needed) ═══
ALTER TABLE orders DROP COLUMN IF EXISTS tax_invoice_status;

-- ═══ 3. Replace order_status_enum ═══
ALTER TYPE order_status_enum RENAME TO order_status_enum_old;

CREATE TYPE order_status_enum AS ENUM (
  'draft', 'confirmed', 'delivered', 'invoiced', 'cancelled'
);

ALTER TABLE orders
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE order_status_enum USING status::text::order_status_enum,
  ALTER COLUMN status SET DEFAULT 'draft';

DROP TYPE order_status_enum_old;
