-- Migration: Fix webhook functions for Supabase Cloud
-- Supabase Cloud postgres role is not superuser, so ALTER DATABASE SET for custom GUCs fails.
-- Solution: create a helper function that returns Cloud-specific settings.
-- This replaces the current_setting('app.settings.*') calls.

CREATE OR REPLACE FUNCTION public.get_app_setting(key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN key = 'supabase_url' THEN 'https://npmxlmjatwqugactcqzd.supabase.co'
    WHEN key = 'service_role_key' THEN 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbXhsbWphdHdxdWdhY3RjcXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk4MjAzMywiZXhwIjoyMDkwNTU4MDMzfQ.-S_QGvc-jt4t3sDLo0WRKpdRZGsBvlUKX68ML6dLZzo'
    ELSE current_setting('app.settings.' || key, true)
  END;
$$;

-- Update notify_parse_message to use get_app_setting()
CREATE OR REPLACE FUNCTION public.notify_parse_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := public.get_app_setting('supabase_url') || '/functions/v1/parse-message';
  service_role_key  := public.get_app_setting('service_role_key');

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Webhook settings not configured, skipping parse-message';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := edge_function_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_role_key),
    body    := jsonb_build_object('type','INSERT','table','raw_messages','record',row_to_json(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'parse-message webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$func$;

-- Update notify_new_order
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := public.get_app_setting('supabase_url') || '/functions/v1/send-push';
  service_role_key  := public.get_app_setting('service_role_key');

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Webhook settings not configured, skipping send-push';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := edge_function_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_role_key),
    body    := jsonb_build_object('type','INSERT','table','orders','record',row_to_json(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'send-push webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$func$;
