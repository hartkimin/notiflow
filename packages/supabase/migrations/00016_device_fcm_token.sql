-- ============================================================
-- Migration: 00016_device_fcm_token.sql
-- Description: Add fcm_token column to mobile_devices table
--   so the send-push Edge Function can target specific devices.
-- ============================================================

ALTER TABLE public.mobile_devices
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

COMMENT ON COLUMN public.mobile_devices.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
