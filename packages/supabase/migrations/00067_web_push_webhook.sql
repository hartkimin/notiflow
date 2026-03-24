-- Web push notification webhook for new captured messages
-- Sends browser push notifications via send-web-push Edge Function

CREATE OR REPLACE FUNCTION notify_send_web_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Read settings (same pattern as 00004_webhooks.sql)
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not read app.settings for web push webhook: %', SQLERRM;
    RETURN NEW;
  END;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'captured_messages',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_captured_message_inserted_web_push
  AFTER INSERT ON captured_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_send_web_push();
