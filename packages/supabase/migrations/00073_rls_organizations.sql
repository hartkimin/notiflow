-- ============================================================================
-- Migration: 00073_rls_organizations.sql
-- Description: Update RLS policies for multi-tenant org-scoped access
--
-- All DDL is wrapped in DO blocks with IF EXISTS table checks so this
-- migration is safe to run against any database state.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop old role-based policies (safe even if table/policy doesn't exist)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  drops TEXT[][] := ARRAY[
    ARRAY['hospitals',          'admin_all_hospitals'],
    ARRAY['hospitals',          'viewer_select_hospitals'],
    ARRAY['products',           'admin_all_products'],
    ARRAY['products',           'viewer_select_products'],
    ARRAY['product_aliases',    'admin_all_product_aliases'],
    ARRAY['product_aliases',    'viewer_select_product_aliases'],
    ARRAY['product_box_specs',  'admin_all_product_box_specs'],
    ARRAY['product_box_specs',  'viewer_select_product_box_specs'],
    ARRAY['suppliers',          'admin_all_suppliers'],
    ARRAY['suppliers',          'viewer_select_suppliers'],
    ARRAY['product_suppliers',  'admin_all_product_suppliers'],
    ARRAY['product_suppliers',  'viewer_select_product_suppliers'],
    ARRAY['raw_messages',       'admin_all_raw_messages'],
    ARRAY['raw_messages',       'viewer_select_raw_messages'],
    ARRAY['raw_messages',       'app_insert_raw_messages'],
    ARRAY['orders',             'admin_all_orders'],
    ARRAY['orders',             'viewer_select_orders'],
    ARRAY['order_items',        'admin_all_order_items'],
    ARRAY['order_items',        'viewer_select_order_items'],
    ARRAY['parse_history',      'admin_all_parse_history'],
    ARRAY['parse_history',      'viewer_select_parse_history'],
    ARRAY['notification_logs',  'admin_all_notification_logs'],
    ARRAY['notification_logs',  'viewer_select_notification_logs'],
    ARRAY['kpis_reports',       'admin_all_kpis_reports'],
    ARRAY['kpis_reports',       'viewer_select_kpis_reports'],
    ARRAY['sales_reports',      'admin_all_sales_reports'],
    ARRAY['sales_reports',      'viewer_select_sales_reports'],
    ARRAY['user_profiles',      'admin_all_user_profiles'],
    ARRAY['user_profiles',      'viewer_select_own_profile'],
    ARRAY['settings',           'admin_all_settings']
  ];
  d TEXT[];
BEGIN
  FOREACH d SLICE 1 IN ARRAY drops LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=d[1]) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', d[2], d[1]);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Update helper functions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims    JSONB;
  user_role TEXT;
  org_id    UUID;
  org_role  TEXT;
BEGIN
  claims := event->'claims';
  SELECT up.role, up.organization_id, up.org_role
    INTO user_role, org_id, org_role
    FROM public.user_profiles up
   WHERE up.id = (event->>'user_id')::UUID;
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'viewer')));
  claims := jsonb_set(claims, '{org_id}',    to_jsonb(org_id));
  claims := jsonb_set(claims, '{org_role}',  to_jsonb(COALESCE(org_role, 'member')));
  event  := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. organizations table policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS org_select_own ON public.organizations;
DROP POLICY IF EXISTS org_admin_all  ON public.organizations;

CREATE POLICY org_select_own ON public.organizations FOR SELECT
  USING (id = public.get_user_org_id() OR public.get_user_role() = 'admin' OR is_demo = true);

CREATE POLICY org_admin_all ON public.organizations FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 4. Org-scoped policies — one DO block per table so each is independent
-- ----------------------------------------------------------------------------

-- Helper: creates SELECT + mutate policies for a standard org-scoped table
-- Called inline via EXECUTE since PL/pgSQL can't define local macros.

DO $$
DECLARE
  -- [table, select_policy, mutate_policy]
  standard_tables TEXT[] := ARRAY[
    'hospitals','products','suppliers','product_aliases','product_box_specs',
    'product_suppliers','orders','order_items','parse_history','kpis_reports',
    'tax_invoices','tax_invoice_items','tax_invoice_orders'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY standard_tables LOOP
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') THEN
      CONTINUE;
    END IF;

    -- Drop old new-style policies if re-running
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_mutate', t);

    -- SELECT: own org OR super-admin OR demo org
    EXECUTE format($policy$
      CREATE POLICY %I ON public.%I FOR SELECT
        USING (
          organization_id = public.get_user_org_id()
          OR public.get_user_role() = 'admin'
          OR EXISTS (SELECT 1 FROM public.organizations WHERE id = %I.organization_id AND is_demo = true)
        )
    $policy$, t || '_select', t, t);

    -- ALL (mutate): org admin/owner OR super-admin
    EXECUTE format($policy$
      CREATE POLICY %I ON public.%I FOR ALL
        USING (
          (organization_id = public.get_user_org_id() AND public.is_org_admin())
          OR public.get_user_role() = 'admin'
        )
        WITH CHECK (
          (organization_id = public.get_user_org_id() AND public.is_org_admin())
          OR public.get_user_role() = 'admin'
        )
    $policy$, t || '_mutate', t);
  END LOOP;
END $$;

-- Android app insert on raw_messages
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='raw_messages')
  AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='raw_messages' AND column_name='organization_id')
  THEN
    DROP POLICY IF EXISTS raw_messages_app_insert ON public.raw_messages;
    CREATE POLICY raw_messages_app_insert ON public.raw_messages FOR INSERT
      WITH CHECK (
        public.get_user_role() = 'app'
        AND organization_id = public.get_user_org_id()
      );
  END IF;
END $$;

-- Enable RLS on tax invoice tables (may not have been enabled previously)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='tax_invoices') THEN
    ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='tax_invoice_items') THEN
    ALTER TABLE public.tax_invoice_items ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='tax_invoice_orders') THEN
    ALTER TABLE public.tax_invoice_orders ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- settings (no demo access)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='settings')
  AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name='organization_id')
  THEN
    DROP POLICY IF EXISTS settings_select ON public.settings;
    DROP POLICY IF EXISTS settings_mutate ON public.settings;
    CREATE POLICY settings_select ON public.settings FOR SELECT
      USING (organization_id = public.get_user_org_id() OR public.get_user_role() = 'admin');
    CREATE POLICY settings_mutate ON public.settings FOR ALL
      USING ((organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin')
      WITH CHECK ((organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin');
  END IF;
END $$;

-- notification_logs (nullable org_id)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_logs') THEN
    DROP POLICY IF EXISTS notification_logs_select ON public.notification_logs;
    DROP POLICY IF EXISTS notification_logs_mutate ON public.notification_logs;
    CREATE POLICY notification_logs_select ON public.notification_logs FOR SELECT
      USING (organization_id IS NULL OR organization_id = public.get_user_org_id() OR public.get_user_role() = 'admin');
    CREATE POLICY notification_logs_mutate ON public.notification_logs FOR ALL
      USING (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin')
      WITH CHECK (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin');
  END IF;
END $$;

-- sales_reports (nullable org_id)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='sales_reports') THEN
    DROP POLICY IF EXISTS sales_reports_select ON public.sales_reports;
    DROP POLICY IF EXISTS sales_reports_mutate ON public.sales_reports;
    CREATE POLICY sales_reports_select ON public.sales_reports FOR SELECT
      USING (organization_id IS NULL OR organization_id = public.get_user_org_id() OR public.get_user_role() = 'admin');
    CREATE POLICY sales_reports_mutate ON public.sales_reports FOR ALL
      USING (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin')
      WITH CHECK (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin');
  END IF;
END $$;

-- user_profiles
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_mutate ON public.user_profiles;

CREATE POLICY user_profiles_select ON public.user_profiles FOR SELECT
  USING (organization_id = public.get_user_org_id() OR id = auth.uid() OR public.get_user_role() = 'admin');

CREATE POLICY user_profiles_mutate ON public.user_profiles FOR ALL
  USING (id = auth.uid() OR (organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin')
  WITH CHECK (id = auth.uid() OR (organization_id = public.get_user_org_id() AND public.is_org_admin()) OR public.get_user_role() = 'admin');
