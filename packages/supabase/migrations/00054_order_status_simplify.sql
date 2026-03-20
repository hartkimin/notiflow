-- 00054_order_status_simplify.sql
-- Simplify order status: remove processing, add invoiced, drop tax_invoice_status

-- ═══ 1. Convert status column to text (so we can use any value freely) ═══
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- ═══ 2. Migrate existing data ═══

-- Move all processing → delivered
UPDATE orders SET status = 'delivered' WHERE status = 'processing';

-- Move delivered+fully-invoiced → invoiced (read tax_invoice_status before dropping)
UPDATE orders SET status = 'invoiced'
WHERE status = 'delivered' AND tax_invoice_status = 'issued';

-- ═══ 3. Drop tax_invoice_status column (no longer needed) ═══
ALTER TABLE orders DROP COLUMN IF EXISTS tax_invoice_status;

-- ═══ 4. Drop old enum and create new one ═══
DROP TYPE order_status_enum;

CREATE TYPE order_status_enum AS ENUM (
  'draft', 'confirmed', 'delivered', 'invoiced', 'cancelled'
);

-- ═══ 5. Cast column back to the new enum ═══
ALTER TABLE orders ALTER COLUMN status TYPE order_status_enum USING status::order_status_enum;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'draft';
