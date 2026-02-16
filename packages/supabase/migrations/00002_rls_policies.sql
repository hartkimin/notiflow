-- ============================================================================
-- Migration: 00002_rls_policies.sql
-- Description: Row Level Security policies for all tables
-- Roles:
--   admin  - full CRUD on every table
--   viewer - read-only on most tables, own profile only on user_profiles
--   app    - INSERT + SELECT own rows on raw_messages only
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS helper function
--    Returns the role of the currently authenticated user from user_profiles.
--    SECURITY DEFINER so it can read user_profiles regardless of RLS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 2. Enable RLS on ALL tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.hospitals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_aliases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_box_specs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_suppliers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parse_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings            ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES BY ROLE
-- ============================================================================

-- ============================================================================
-- 3a. ADMIN — full CRUD on every table (FOR ALL)
-- ============================================================================

CREATE POLICY admin_all_hospitals
  ON public.hospitals FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_products
  ON public.products FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_product_aliases
  ON public.product_aliases FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_product_box_specs
  ON public.product_box_specs FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_suppliers
  ON public.suppliers FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_product_suppliers
  ON public.product_suppliers FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_raw_messages
  ON public.raw_messages FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_orders
  ON public.orders FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_order_items
  ON public.order_items FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_parse_history
  ON public.parse_history FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_notification_logs
  ON public.notification_logs FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_kpis_reports
  ON public.kpis_reports FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_sales_reports
  ON public.sales_reports FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_user_profiles
  ON public.user_profiles FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY admin_all_settings
  ON public.settings FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================================
-- 3b. VIEWER — SELECT only on most tables, own profile on user_profiles
--     No access to: settings
-- ============================================================================

CREATE POLICY viewer_select_hospitals
  ON public.hospitals FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_products
  ON public.products FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_product_aliases
  ON public.product_aliases FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_product_box_specs
  ON public.product_box_specs FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_suppliers
  ON public.suppliers FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_product_suppliers
  ON public.product_suppliers FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_orders
  ON public.orders FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_order_items
  ON public.order_items FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_raw_messages
  ON public.raw_messages FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_parse_history
  ON public.parse_history FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_notification_logs
  ON public.notification_logs FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_kpis_reports
  ON public.kpis_reports FOR SELECT
  USING (public.get_user_role() = 'viewer');

CREATE POLICY viewer_select_sales_reports
  ON public.sales_reports FOR SELECT
  USING (public.get_user_role() = 'viewer');

-- Viewer can only see their own profile
CREATE POLICY viewer_select_own_profile
  ON public.user_profiles FOR SELECT
  USING (public.get_user_role() = 'viewer' AND id = auth.uid());

-- ============================================================================
-- 3c. APP — Kotlin mobile app
--     INSERT on raw_messages only (per design spec)
-- ============================================================================

CREATE POLICY app_insert_raw_messages
  ON public.raw_messages FOR INSERT
  WITH CHECK (public.get_user_role() = 'app');

-- ============================================================================
-- 4. Auth Hook function — JWT custom claims
--    Injects user_role into the access token so the client and RLS policies
--    can use it without an extra round-trip.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
BEGIN
  claims := event->'claims';

  SELECT role INTO user_role
    FROM public.user_profiles
    WHERE id = (event->>'user_id')::UUID;

  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'viewer')));
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant the auth admin service role permission to call the hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from all other roles for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
