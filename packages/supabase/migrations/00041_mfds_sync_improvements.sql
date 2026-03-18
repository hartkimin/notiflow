-- 00039_mfds_sync_improvements.sql
-- Improve MFDS sync: add sync_mode, api_total_count, failed_pages tracking

-- sync_mode: 'full' (no date filter, all items) | 'incremental' (date-window based)
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS sync_mode TEXT DEFAULT 'incremental';

-- Store API's reported totalCount for completeness validation
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS api_total_count INT;

-- Track pages that failed during sync for targeted retry
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS failed_pages JSONB DEFAULT '[]'::jsonb;

-- Track last successful full sync per source_type in a lightweight table
CREATE TABLE IF NOT EXISTS mfds_sync_meta (
  source_type   TEXT PRIMARY KEY,        -- 'drug' | 'device_std'
  last_full_sync_at   TIMESTAMPTZ,       -- When the last full sync completed
  last_incremental_at TIMESTAMPTZ,       -- When the last incremental sync completed
  api_total_count     INT,               -- Latest known API totalCount
  local_count         INT,               -- Latest known local DB count
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for mfds_sync_meta
ALTER TABLE mfds_sync_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_sync_meta"
  ON mfds_sync_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_sync_meta"
  ON mfds_sync_meta FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index on mfds_items permit_date for faster date-range queries
CREATE INDEX IF NOT EXISTS idx_mfds_items_permit_date
  ON mfds_items (permit_date) WHERE permit_date IS NOT NULL;
