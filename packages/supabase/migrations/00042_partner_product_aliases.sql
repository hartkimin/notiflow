-- 00042_partner_product_aliases.sql
-- Per-partner-product aliases for search matching

-- 1. Normalization function: strips whitespace, punctuation, lowercases
CREATE OR REPLACE FUNCTION normalize_alias(input TEXT) RETURNS TEXT AS $$
  SELECT lower(regexp_replace(input, '[[:space:][:punct:]]', '', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- 2. Table
CREATE TABLE partner_product_aliases (
  id                 SERIAL PRIMARY KEY,
  partner_product_id INTEGER NOT NULL REFERENCES partner_products(id) ON DELETE CASCADE,
  alias              TEXT NOT NULL CHECK (char_length(alias) BETWEEN 1 AND 50),
  alias_normalized   TEXT NOT NULL CHECK (alias_normalized <> ''),
  match_count        INTEGER NOT NULL DEFAULT 0,
  last_matched_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Unique constraint: same item can't have duplicate normalized alias
ALTER TABLE partner_product_aliases
  ADD CONSTRAINT uq_partner_product_alias UNIQUE (partner_product_id, alias_normalized);

-- 4. Indexes
CREATE INDEX idx_ppa_partner_product ON partner_product_aliases(partner_product_id);
CREATE INDEX idx_ppa_alias_trgm ON partner_product_aliases USING gin (alias_normalized gin_trgm_ops);

-- 5. Trigger: max 5 aliases per partner_product
CREATE OR REPLACE FUNCTION check_alias_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM partner_product_aliases WHERE partner_product_id = NEW.partner_product_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 aliases per partner product';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alias_limit
  BEFORE INSERT ON partner_product_aliases
  FOR EACH ROW EXECUTE FUNCTION check_alias_limit();

-- 6. Trigger: unique alias within same partner (partner_type + partner_id)
CREATE OR REPLACE FUNCTION check_alias_unique_per_partner() RETURNS TRIGGER AS $$
DECLARE
  _partner_type TEXT;
  _partner_id INT;
  _conflict_name TEXT;
BEGIN
  SELECT partner_type, partner_id INTO _partner_type, _partner_id
    FROM partner_products WHERE id = NEW.partner_product_id;

  SELECT pp.standard_code INTO _conflict_name
    FROM partner_product_aliases ppa
    JOIN partner_products pp ON pp.id = ppa.partner_product_id
    WHERE pp.partner_type = _partner_type
      AND pp.partner_id = _partner_id
      AND ppa.alias_normalized = NEW.alias_normalized
      AND ppa.partner_product_id <> NEW.partner_product_id
    LIMIT 1;

  IF _conflict_name IS NOT NULL THEN
    RAISE EXCEPTION 'Alias already used by another product in this partner (code: %)', _conflict_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alias_unique_per_partner
  BEFORE INSERT ON partner_product_aliases
  FOR EACH ROW EXECUTE FUNCTION check_alias_unique_per_partner();

-- 7. updated_at trigger (reuse existing function)
CREATE TRIGGER update_partner_product_aliases_updated_at
  BEFORE UPDATE ON partner_product_aliases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. RLS (permissive, matching partner_products pattern)
ALTER TABLE partner_product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for partner_product_aliases"
  ON partner_product_aliases FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated full access for partner_product_aliases"
  ON partner_product_aliases FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
