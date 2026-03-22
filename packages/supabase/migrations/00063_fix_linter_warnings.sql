-- ═══════════════════════════════════════════════════════════════════════
-- Fix Supabase linter warnings:
-- 1. function_search_path_mutable — set search_path on all public functions
-- 2. extension_in_public — move pg_trgm to extensions schema
-- 3. rls_policy_always_true — fix stale forecast policies (00061 re-apply)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Fix function search_path (prevents search_path injection) ────

ALTER FUNCTION public.custom_access_token_hook(event jsonb) SET search_path TO 'public';
ALTER FUNCTION public.get_user_role() SET search_path TO 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path TO 'public';
ALTER FUNCTION public.audit_order_changes() SET search_path TO 'public';
ALTER FUNCTION public.notify_send_push() SET search_path TO 'public';
ALTER FUNCTION public.update_device_token_timestamp() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_old_logs() SET search_path TO 'public';
ALTER FUNCTION public.generate_order_number() SET search_path TO 'public';
ALTER FUNCTION public.generate_invoice_number() SET search_path TO 'public';
ALTER FUNCTION public.normalize_alias(input text) SET search_path TO 'public';
ALTER FUNCTION public.check_alias_limit() SET search_path TO 'public';
ALTER FUNCTION public.check_alias_unique_per_partner() SET search_path TO 'public';
ALTER FUNCTION public.increment_alias_match_counts(alias_ids integer[]) SET search_path TO 'public';
ALTER FUNCTION public.get_chat_rooms(p_query text, p_source_filter text) SET search_path TO 'public';
ALTER FUNCTION public.search_chat_messages(p_source text, p_room_id text, p_query text, p_limit integer, p_offset integer) SET search_path TO 'public';
ALTER FUNCTION public.get_daily_stats(target_date date) SET search_path TO 'public';
ALTER FUNCTION public.get_sales_report(target_period text) SET search_path TO 'public';
ALTER FUNCTION public.get_hospital_stats(from_date date, to_date date) SET search_path TO 'public';
ALTER FUNCTION public.get_product_stats(from_date date, to_date date) SET search_path TO 'public';
ALTER FUNCTION public.get_trend_stats(from_date date, to_date date) SET search_path TO 'public';
ALTER FUNCTION public.get_calendar_stats(target_month text) SET search_path TO 'public';
ALTER FUNCTION public.get_sales_rep_stats(target_month date) SET search_path TO 'public';
ALTER FUNCTION public.get_monthly_sales_trend(months_limit integer) SET search_path TO 'public';

-- ─── 2. Move pg_trgm extension to extensions schema ─────────────────

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ─── 3. Fix stale forecast RLS policies (re-apply 00061 idempotently) ─

DROP POLICY IF EXISTS "dashboard_forecasts_all" ON order_forecasts;
DROP POLICY IF EXISTS "dashboard_forecast_items_all" ON forecast_items;
DROP POLICY IF EXISTS "dashboard_order_patterns_all" ON order_patterns;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_forecasts_all' AND tablename = 'order_forecasts') THEN
    CREATE POLICY "authenticated_forecasts_all" ON order_forecasts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_forecast_items_all' AND tablename = 'forecast_items') THEN
    CREATE POLICY "authenticated_forecast_items_all" ON forecast_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_order_patterns_all' AND tablename = 'order_patterns') THEN
    CREATE POLICY "authenticated_order_patterns_all" ON order_patterns FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
