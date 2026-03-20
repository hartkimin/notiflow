-- 00045_mfds_sync_race_guard.sql
-- Prevent concurrent syncs for the same source_type at DB level.
-- Only one row with status='running' per source_type is allowed.

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfds_sync_one_running
  ON mfds_sync_logs (source_type)
  WHERE status = 'running';
