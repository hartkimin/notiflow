-- Add sales representative free-text field to order items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sales_rep VARCHAR(100);
