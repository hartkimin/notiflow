-- 00048_order_items_product_name.sql
-- Add product_name column to order_items for direct product name storage
-- (not all items have a product_id FK — drug/device items store name directly)

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Backfill from products table where product_id exists
UPDATE order_items oi
SET product_name = p.name
FROM products p
WHERE oi.product_id = p.id
  AND oi.product_name IS NULL;
