-- ============================================================
-- 25. pg_cron: Daily MFDS sync at KST 05:00 / 05:05 / 05:10
--
-- IMPORTANT: Run this MANUALLY in Supabase SQL Editor.
-- Replace <SUPABASE_URL> and <SERVICE_ROLE_KEY> with actual values.
-- This file is kept here for documentation purposes.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drug API sync at KST 05:00 (UTC 20:00)
SELECT cron.schedule(
  'sync-mfds-drug',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/sync-mfds',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger":"scheduled","source":"drug"}'::jsonb
  );
  $$
);

-- Device API sync at KST 05:05 (UTC 20:05)
SELECT cron.schedule(
  'sync-mfds-device',
  '5 20 * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/sync-mfds',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger":"scheduled","source":"device"}'::jsonb
  );
  $$
);

-- Device Std (UDI) API sync at KST 05:10 (UTC 20:10)
SELECT cron.schedule(
  'sync-mfds-device-std',
  '10 20 * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/sync-mfds',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger":"scheduled","source":"device_std"}'::jsonb
  );
  $$
);

-- Verify schedules:
-- SELECT * FROM cron.job WHERE jobname LIKE 'sync-mfds%';
