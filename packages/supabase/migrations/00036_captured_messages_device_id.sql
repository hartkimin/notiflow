-- ============================================================
-- Migration: 00036_captured_messages_device_id.sql
-- Description: Add device_id column to captured_messages for
--   tracking which mobile device captured each message.
--   device_id format: "{user_id}_{android_id}" (matches mobile_devices.id)
-- ============================================================

ALTER TABLE public.captured_messages
  ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Index for filtering messages by device
CREATE INDEX IF NOT EXISTS idx_mob_messages_device
  ON public.captured_messages(device_id);

COMMENT ON COLUMN public.captured_messages.device_id
  IS 'Mobile device ID that captured this message ({user_id}_{android_id})';
