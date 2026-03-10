-- 00039_order_supply_chain.sql
-- Unify product management around mfds_items, create supplier/hospital item linkages,
-- add pricing columns for the supply chain flow.

BEGIN;

----------------------------------------------------------------------
-- 0. Ensure mfds_items.raw_data exists
----------------------------------------------------------------------
ALTER TABLE mfds_items ADD COLUMN IF NOT EXISTS raw_data JSONB;

----------------------------------------------------------------------
-- 1. Drop legacy objects that depend on 'products' table
----------------------------------------------------------------------

DROP VIEW IF EXISTS products_catalog;

ALTER TABLE order_items DROP COLUMN IF EXISTS box_spec_id;

DROP TABLE IF EXISTS product_box_specs CASCADE;
DROP TABLE IF EXISTS product_aliases CASCADE;
DROP TABLE IF EXISTS product_suppliers CASCADE;

ALTER TABLE forecast_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE forecast_items ADD COLUMN IF NOT EXISTS mfds_item_id BIGINT REFERENCES mfds_items(id);

ALTER TABLE order_items DROP COLUMN IF EXISTS unit_type;
ALTER TABLE order_items DROP COLUMN IF EXISTS calculated_pieces;
ALTER TABLE order_items DROP COLUMN IF EXISTS original_text;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_confidence;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE order_items RENAME COLUMN product_id TO mfds_item_id;
  END IF;
END $$;
ALTER TABLE order_items ALTER COLUMN mfds_item_id TYPE BIGINT USING mfds_item_id::BIGINT;
ALTER TABLE order_items ADD CONSTRAINT order_items_mfds_item_id_fkey
  FOREIGN KEY (mfds_item_id) REFERENCES mfds_items(id);

DROP TABLE IF EXISTS products CASCADE;

----------------------------------------------------------------------
-- 2. Add pricing columns to existing tables
----------------------------------------------------------------------

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS default_margin_rate DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS display_columns JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS final_price DECIMAL(12,2);

----------------------------------------------------------------------
-- 3. Create new junction tables
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supplier_items (
  id            SERIAL PRIMARY KEY,
  supplier_id   INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  mfds_item_id  BIGINT NOT NULL REFERENCES mfds_items(id) ON DELETE CASCADE,
  purchase_price DECIMAL(12,2),
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, mfds_item_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_mfds_item ON supplier_items(mfds_item_id);

CREATE TABLE IF NOT EXISTS hospital_items (
  id             SERIAL PRIMARY KEY,
  hospital_id    INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  mfds_item_id   BIGINT NOT NULL REFERENCES mfds_items(id) ON DELETE CASCADE,
  delivery_price DECIMAL(12,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, mfds_item_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_items_hospital ON hospital_items(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_items_mfds_item ON hospital_items(mfds_item_id);

COMMIT;
