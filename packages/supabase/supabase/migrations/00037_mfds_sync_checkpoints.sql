-- 00037_mfds_sync_checkpoints.sql
-- Checkpoint table for incremental MFDS sync

CREATE TABLE IF NOT EXISTS mfds_sync_checkpoints (
  source_type    TEXT PRIMARY KEY,
  db_count       INT NOT NULL DEFAULT 0,
  api_total      INT NOT NULL DEFAULT 0,
  last_page      INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'idle',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE mfds_sync_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read checkpoints"
  ON mfds_sync_checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage checkpoints"
  ON mfds_sync_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed from existing data
INSERT INTO mfds_sync_checkpoints (source_type, db_count, last_page, status)
SELECT
  source_type,
  COUNT(*)::INT AS db_count,
  (COUNT(*) / 500)::INT AS last_page,
  'idle' AS status
FROM mfds_items
GROUP BY source_type
ON CONFLICT (source_type) DO NOTHING;
