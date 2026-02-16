-- ============================================================
-- Migration: 00012_mobile_devices.sql
-- Description: Table for tracking mobile devices connected to
--   the system. The mobile app upserts a row on each sync,
--   allowing the web dashboard to list and manage devices.
--   Uses TIMESTAMPTZ (not epoch ms) since this table is not
--   bidirectionally synced to Room.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mobile_devices (
  id            TEXT PRIMARY KEY,                 -- "{user_id}_{android_id}"
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name   TEXT NOT NULL,                    -- Build.MODEL
  device_model  TEXT,                             -- "Manufacturer Model"
  app_version   TEXT NOT NULL,
  os_version    TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'android',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_sync_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mobile_devices_user ON public.mobile_devices(user_id);
CREATE INDEX idx_mobile_devices_active ON public.mobile_devices(is_active);

-- Trigger: auto-update updated_at (function defined in 00001)
CREATE TRIGGER update_mobile_devices_updated_at
  BEFORE UPDATE ON public.mobile_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;

-- Admin: full access (dashboard management)
CREATE POLICY admin_all_mobile_devices
  ON public.mobile_devices FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Viewer: read-only (dashboard view)
CREATE POLICY viewer_select_mobile_devices
  ON public.mobile_devices FOR SELECT
  USING (public.get_user_role() = 'viewer');

-- Mobile user: manage own devices
CREATE POLICY user_manage_own_mobile_devices
  ON public.mobile_devices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Realtime: add to publication
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mobile_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_devices;
  END IF;
END
$$;
