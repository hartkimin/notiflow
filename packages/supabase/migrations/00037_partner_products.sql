-- 00036_partner_products.sql
-- Manage products associated with Hospitals and Suppliers with price tracking

-- 1. Create partner_products table
-- Links a partner (hospital or supplier) to a product from our catalog
CREATE TABLE partner_products (
  id                SERIAL PRIMARY KEY,
  partner_type      TEXT NOT NULL CHECK (partner_type IN ('hospital', 'supplier')),
  partner_id        INT NOT NULL, -- FK to hospitals.id or suppliers.id
  
  -- Product Reference (supports multiple sources via view-like mapping)
  product_source    TEXT NOT NULL CHECK (product_source IN ('product', 'drug', 'device')),
  product_id        INT NOT NULL, -- ID in products, my_drugs, or my_devices
  standard_code     TEXT, -- Standard code for cross-referencing
  
  -- Commercial Info
  unit_price        DECIMAL(12,2),
  currency          VARCHAR(10) DEFAULT 'KRW',
  
  -- Tracking
  price_history     JSONB DEFAULT '[]', -- List of {price, changed_at, reason}
  notes             TEXT,
  is_active         BOOLEAN DEFAULT true,
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints: One partner should have a product only once
  UNIQUE(partner_type, partner_id, product_source, product_id)
);

-- 2. Add indexes
CREATE INDEX idx_partner_products_partner ON partner_products(partner_type, partner_id);
CREATE INDEX idx_partner_products_product ON partner_products(product_source, product_id);

-- 3. Trigger for updated_at
CREATE TRIGGER update_partner_products_updated_at
  BEFORE UPDATE ON partner_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable RLS
ALTER TABLE partner_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for partner_products"
  ON partner_products FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated full access for partner_products"
  ON partner_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Comment for clarity
COMMENT ON COLUMN partner_products.price_history IS 'History of price changes stored as JSONB array';
