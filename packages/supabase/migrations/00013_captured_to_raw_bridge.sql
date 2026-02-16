-- ============================================================
-- Migration: 00013_captured_to_raw_bridge.sql
-- Description: Bridge trigger that copies new rows from
--   captured_messages (mobile sync) into raw_messages (order
--   processing pipeline). This enables the full flow:
--     Mobile capture → captured_messages INSERT
--       → this trigger → raw_messages INSERT
--         → on_raw_message_inserted → parse-message Edge Function
--           → AI parse → order creation
--
--   Deduplication: stores 'cap:<captured_id>' in raw_messages.device_id
--   to prevent duplicates when the mobile app re-syncs (upsert = UPDATE,
--   which does not re-fire this INSERT trigger).
-- ============================================================

CREATE OR REPLACE FUNCTION public.bridge_captured_to_raw()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ref TEXT := 'cap:' || NEW.id;
  mapped_source VARCHAR(50);
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

  INSERT INTO public.raw_messages (
    source_app,
    sender,
    content,
    received_at,
    device_id
  ) VALUES (
    substring(mapped_source, 1, 50),
    substring(NEW.sender, 1, 255),
    COALESCE(NEW.original_content, NEW.content),
    to_timestamp(NEW.received_at / 1000.0),
    ref
  );

  RETURN NEW;
END;
$$;

-- Trigger: only on INSERT (upsert of existing rows fires UPDATE, not INSERT)
CREATE TRIGGER bridge_captured_message
  AFTER INSERT ON public.captured_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.bridge_captured_to_raw();
