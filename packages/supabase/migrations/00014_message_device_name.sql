-- ============================================================
-- Migration: 00014_message_device_name.sql
-- Description:
--   1. Add device_name column to raw_messages for device tracking
--   2. Update bridge trigger to populate device_name from mobile_devices
--   3. Add admin RLS policy on captured_messages so dashboard admin
--      can view all captured messages (not just their own)
-- ============================================================

-- 1. Add device_name column to raw_messages
ALTER TABLE public.raw_messages
  ADD COLUMN IF NOT EXISTS device_name TEXT;

-- 2. Backfill device_name for existing bridged messages
--    For rows with device_id = 'cap:<captured_id>', look up the user_id
--    from captured_messages, then find device_name from mobile_devices.
UPDATE public.raw_messages rm
SET device_name = md.device_name
FROM public.captured_messages cm
JOIN public.mobile_devices md ON md.user_id = cm.user_id
WHERE rm.device_id = 'cap:' || cm.id
  AND rm.device_name IS NULL;

-- 3. Replace the bridge trigger function to include device_name
CREATE OR REPLACE FUNCTION public.bridge_captured_to_raw()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref TEXT := 'cap:' || NEW.id;
  mapped_source VARCHAR(50);
  v_device_name TEXT;
BEGIN
  -- Skip deleted or archived messages
  IF NEW.is_deleted OR NEW.is_archived THEN
    RETURN NEW;
  END IF;

  -- Skip if already bridged (dedup check)
  IF EXISTS (
    SELECT 1 FROM public.raw_messages WHERE device_id = ref
  ) THEN
    RETURN NEW;
  END IF;

  -- Map package name / source to dashboard source_app key
  mapped_source := CASE
    WHEN NEW.source ILIKE '%kakao%'    THEN 'kakaotalk'
    WHEN NEW.source ILIKE '%telegram%' THEN 'telegram'
    WHEN NEW.source = 'SMS'            THEN 'sms'
    WHEN NEW.source ILIKE '%mms%'      THEN 'sms'
    WHEN NEW.source ILIKE '%messaging%' THEN 'sms'
    ELSE COALESCE(NULLIF(NEW.app_name, ''), NEW.source)
  END;

  -- Look up device name from mobile_devices (pick most recently synced device)
  SELECT md.device_name INTO v_device_name
  FROM public.mobile_devices md
  WHERE md.user_id = NEW.user_id
    AND md.is_active = true
  ORDER BY md.last_sync_at DESC
  LIMIT 1;

  INSERT INTO public.raw_messages (
    source_app,
    sender,
    content,
    received_at,
    device_id,
    device_name
  ) VALUES (
    substring(mapped_source, 1, 50),
    substring(NEW.sender, 1, 255),
    COALESCE(NEW.original_content, NEW.content),
    to_timestamp(NEW.received_at / 1000.0),
    ref,
    v_device_name
  );

  RETURN NEW;
END;
$$;

-- 4. Admin RLS policy on captured_messages
--    Allows admin users to view all captured messages in the dashboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'captured_messages'
      AND policyname = 'admin_all_captured_messages'
  ) THEN
    CREATE POLICY admin_all_captured_messages
      ON public.captured_messages FOR ALL
      USING (public.get_user_role() = 'admin')
      WITH CHECK (public.get_user_role() = 'admin');
  END IF;
END
$$;
