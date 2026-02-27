-- 00035_mfds_sync_partial.sql
-- Add next_page column for client-driven continuation of partial syncs.
-- Status 'partial' indicates the sync hit the time budget and needs continuation.

ALTER TABLE mfds_sync_logs ADD COLUMN IF NOT EXISTS next_page INT;
