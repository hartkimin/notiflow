-- 00004_webhooks.sql
-- DB Webhook triggers for Edge Functions via pg_net
-- raw_messages INSERT → parse-message Edge Function
-- orders INSERT → send-push Edge Function

-- Ensure pg_net extension is available (already enabled on Supabase hosted)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────
-- 1. raw_messages INSERT → parse-message
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_parse_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/parse-message';
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Webhook settings not configured, skipping parse-message';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'raw_messages',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_raw_message_inserted
  AFTER INSERT ON raw_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_parse_message();

-- ─────────────────────────────────────────────────
-- 2. orders INSERT → send-push
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/send-push';
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Webhook settings not configured, skipping send-push';
    RETURN NEW;
  END IF;

  -- Only trigger for non-cancelled orders
  IF NEW.status != 'cancelled' THEN
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'orders',
        'record', row_to_json(NEW)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_send_push();
