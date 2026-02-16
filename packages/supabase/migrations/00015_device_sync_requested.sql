-- 00015_device_sync_requested.sql
-- Adds sync_requested_at column to mobile_devices for web-triggered sync

ALTER TABLE public.mobile_devices
  ADD COLUMN IF NOT EXISTS sync_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.mobile_devices.sync_requested_at
  IS 'Set by web dashboard to trigger remote sync on the device via Realtime';
