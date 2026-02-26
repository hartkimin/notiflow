-- 00023: Add mfds_items and mfds_sync_logs tables for MFDS (식약처) data sync
-- Also adds mfds_item_id FK to products and update_products_from_mfds RPC

-- ============================================================
-- 1. Extension: pg_trgm for Korean text search
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Enum: mfds_source_type
-- ============================================================
DO $$ BEGIN
  CREATE TYPE mfds_source_type AS ENUM ('drug', 'device', 'device_std');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Table: mfds_items (unified MFDS product registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS mfds_items (
  id                          BIGSERIAL PRIMARY KEY,
  source_type                 mfds_source_type NOT NULL,
  source_key                  VARCHAR(100) NOT NULL,

  -- Common columns
  item_name                   VARCHAR(500) NOT NULL,
  manufacturer                VARCHAR(255),
  permit_no                   VARCHAR(100),
  permit_date                 VARCHAR(20),
  standard_code               VARCHAR(100),
  classification_no           VARCHAR(100),
  classification_grade        VARCHAR(10),
  product_name                VARCHAR(500),
  use_purpose                 TEXT,

  -- Drug-specific columns
  edi_code                    VARCHAR(50),
  atc_code                    VARCHAR(50),
  main_item_ingr              TEXT,
  bizrno                      VARCHAR(20),
  rare_drug_yn                VARCHAR(5),

  -- Device-specific columns
  mnsc_nm                     VARCHAR(255),
  mnsc_natn_cd                VARCHAR(50),
  prmsn_dclr_divs_nm          VARCHAR(50),

  -- Device_std-specific columns
  foml_info                   VARCHAR(500),
  hmbd_trspt_mdeq_yn          VARCHAR(5),
  dspsbl_mdeq_yn              VARCHAR(5),
  trck_mng_trgt_yn            VARCHAR(5),
  total_dev                   VARCHAR(5),
  cmbnmd_yn                   VARCHAR(5),
  use_before_strlzt_need_yn   VARCHAR(5),
  sterilization_method        VARCHAR(255),
  strg_cnd_info               VARCHAR(255),
  circ_cnd_info               VARCHAR(255),
  rcprslry_trgt_yn            VARCHAR(5),

  -- Meta
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source_type, source_key)
);

-- ============================================================
-- 4. Indexes on mfds_items
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mfds_items_item_name_trgm
  ON mfds_items USING gin (item_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mfds_items_manufacturer_trgm
  ON mfds_items USING gin (manufacturer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mfds_items_source_type
  ON mfds_items (source_type);

CREATE INDEX IF NOT EXISTS idx_mfds_items_standard_code
  ON mfds_items (standard_code)
  WHERE standard_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mfds_items_product_name_trgm
  ON mfds_items USING gin (product_name gin_trgm_ops)
  WHERE product_name IS NOT NULL;

-- ============================================================
-- 5. Trigger: auto-update updated_at on mfds_items
-- ============================================================
CREATE TRIGGER update_mfds_items_updated_at
  BEFORE UPDATE ON mfds_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. Table: mfds_sync_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS mfds_sync_logs (
  id                    BIGSERIAL PRIMARY KEY,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at           TIMESTAMPTZ,
  status                VARCHAR(20) NOT NULL DEFAULT 'running',
  trigger_type          VARCHAR(20) NOT NULL,
  triggered_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_filter         VARCHAR(20),

  -- Stats: drug
  drug_total            INT NOT NULL DEFAULT 0,
  drug_added            INT NOT NULL DEFAULT 0,
  drug_updated          INT NOT NULL DEFAULT 0,

  -- Stats: device
  device_total          INT NOT NULL DEFAULT 0,
  device_added          INT NOT NULL DEFAULT 0,
  device_updated        INT NOT NULL DEFAULT 0,

  -- Stats: device_std
  device_std_total      INT NOT NULL DEFAULT 0,
  device_std_added      INT NOT NULL DEFAULT 0,
  device_std_updated    INT NOT NULL DEFAULT 0,

  -- Stats: products
  products_updated      INT NOT NULL DEFAULT 0,

  -- Error & duration
  error_message         TEXT,
  duration_ms           INT
);

-- Indexes on mfds_sync_logs
CREATE INDEX IF NOT EXISTS idx_mfds_sync_logs_status
  ON mfds_sync_logs (status);

CREATE INDEX IF NOT EXISTS idx_mfds_sync_logs_started_at
  ON mfds_sync_logs (started_at DESC);

-- ============================================================
-- 7. ALTER products: add mfds_item_id FK
-- ============================================================
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN mfds_item_id BIGINT REFERENCES mfds_items(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_mfds_item_id
  ON products (mfds_item_id)
  WHERE mfds_item_id IS NOT NULL;

-- ============================================================
-- 8. RLS policies
-- ============================================================
ALTER TABLE mfds_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select mfds_items"
  ON mfds_items FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE mfds_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select mfds_sync_logs"
  ON mfds_sync_logs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 9. RPC: update_products_from_mfds
-- ============================================================
CREATE OR REPLACE FUNCTION update_products_from_mfds(sync_started TIMESTAMPTZ)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE products p SET
    official_name = m.item_name,
    manufacturer  = m.manufacturer,
    ingredient    = COALESCE(m.main_item_ingr, m.use_purpose),
    efficacy      = m.use_purpose,
    standard_code = m.standard_code
  FROM mfds_items m
  WHERE p.mfds_item_id = m.id
    AND m.updated_at >= sync_started;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
