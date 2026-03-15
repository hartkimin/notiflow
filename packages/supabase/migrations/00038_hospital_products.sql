-- 00038_hospital_products.sql
-- Hospital-Product junction table (table already exists in DB, migration for code consistency)
-- If table already exists, this migration is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_products') THEN
    CREATE TABLE hospital_products (
      id              SERIAL PRIMARY KEY,
      hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      product_id      INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      selling_price   DECIMAL(12,2),
      default_quantity INT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(hospital_id, product_id)
    );

    CREATE INDEX idx_hospital_products_hospital ON hospital_products(hospital_id);
    CREATE INDEX idx_hospital_products_product ON hospital_products(product_id);

    CREATE TRIGGER trg_hospital_products_updated
      BEFORE UPDATE ON hospital_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    ALTER TABLE hospital_products ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can read hospital_products"
      ON hospital_products FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can insert hospital_products"
      ON hospital_products FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update hospital_products"
      ON hospital_products FOR UPDATE TO authenticated USING (true);
    CREATE POLICY "Authenticated users can delete hospital_products"
      ON hospital_products FOR DELETE TO authenticated USING (true);
  END IF;
END
$$;
