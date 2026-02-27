-- 00034_mfds_db_search.sql
-- Revive mfds_items table for DB-backed search with pg_trgm

-- 1. Ensure pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Main search table
CREATE TABLE IF NOT EXISTS mfds_items (
  id              BIGSERIAL PRIMARY KEY,
  source_type     TEXT NOT NULL,         -- 'drug' | 'device_std'
  source_key      TEXT NOT NULL,         -- ITEM_SEQ or UDIDI_CD
  item_name       TEXT NOT NULL,         -- 품목명 (normalized for search)
  manufacturer    TEXT,                  -- 업체명 (normalized for search)
  standard_code   TEXT,                  -- BAR_CODE or UDIDI_CD
  permit_date     TEXT,                  -- 허가일자
  raw_data        JSONB NOT NULL,        -- Full API response preserved
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_key)
);

-- 3. Indexes for search
CREATE INDEX IF NOT EXISTS idx_mfds_items_name_trgm
  ON mfds_items USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_items_mfr_trgm
  ON mfds_items USING gin (manufacturer gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_items_source_type
  ON mfds_items (source_type);
CREATE INDEX IF NOT EXISTS idx_mfds_items_standard_code
  ON mfds_items (standard_code) WHERE standard_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_items_raw_data
  ON mfds_items USING gin (raw_data jsonb_path_ops);

-- 4. Auto-update updated_at trigger
CREATE TRIGGER update_mfds_items_updated_at
  BEFORE UPDATE ON mfds_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Sync logs table
CREATE TABLE IF NOT EXISTS mfds_sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running',  -- running | completed | error
  trigger_type    TEXT NOT NULL,                     -- 'cron' | 'manual'
  source_type     TEXT,                              -- 'drug' | 'device_std' | null (all)
  total_fetched   INT NOT NULL DEFAULT 0,
  total_upserted  INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  duration_ms     INT
);

-- 6. RLS policies
ALTER TABLE mfds_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_items"
  ON mfds_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_items"
  ON mfds_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE mfds_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_sync_logs"
  ON mfds_sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_sync_logs"
  ON mfds_sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
