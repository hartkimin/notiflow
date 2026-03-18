-- 00038_mfds_sync_date_params.sql
-- Add start and end date parameters to sync logs to ensure stable pagination during continuation.

ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS sync_start_date TEXT;
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS sync_end_date TEXT;
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS source_type TEXT; -- Redundant but useful for tracking which specific source is being synced
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS total_fetched INT DEFAULT 0;
ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS total_upserted INT DEFAULT 0;
