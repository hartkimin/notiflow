-- ============================================================================
-- Migration: 00075_fix_rls_admin_bypass.sql
-- Description:
--   1. Remove get_user_role() = 'admin' super-admin bypass from all
--      org-scoped RLS policies. System admins use service_role key
--      (server-side) — not authenticated sessions.
--   2. Remove is_demo = true bypass (demo page uses service_role already).
--   3. Add invite_codes table for controlled signup.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Re-create org-scoped SELECT/mutate policies without admin bypass
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  standard_tables TEXT[] := ARRAY[
    'hospitals','products','suppliers','product_aliases','product_box_specs',
    'product_suppliers','orders','order_items','parse_history','kpis_reports',
    'tax_invoices','tax_invoice_items','tax_invoice_orders'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY standard_tables LOOP
    IF NOT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
    ) THEN CONTINUE; END IF;

    -- Drop existing policies
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_mutate', t);

    -- SELECT: own org only (no admin bypass, no demo bypass)
    EXECUTE format($policy$
      CREATE POLICY %I ON public.%I FOR SELECT
        USING (organization_id = public.get_user_org_id())
    $policy$, t || '_select', t);

    -- ALL (mutate): org admin/owner in own org only
    EXECUTE format($policy$
      CREATE POLICY %I ON public.%I FOR ALL
        USING (
          organization_id = public.get_user_org_id()
          AND public.is_org_admin()
        )
        WITH CHECK (
          organization_id = public.get_user_org_id()
          AND public.is_org_admin()
        )
    $policy$, t || '_mutate', t);
  END LOOP;
END $$;

-- settings
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='settings')
  AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name='organization_id')
  THEN
    DROP POLICY IF EXISTS settings_select ON public.settings;
    DROP POLICY IF EXISTS settings_mutate ON public.settings;
    CREATE POLICY settings_select ON public.settings FOR SELECT
      USING (organization_id = public.get_user_org_id());
    CREATE POLICY settings_mutate ON public.settings FOR ALL
      USING (organization_id = public.get_user_org_id() AND public.is_org_admin())
      WITH CHECK (organization_id = public.get_user_org_id() AND public.is_org_admin());
  END IF;
END $$;

-- notification_logs
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_logs') THEN
    DROP POLICY IF EXISTS notification_logs_select ON public.notification_logs;
    DROP POLICY IF EXISTS notification_logs_mutate ON public.notification_logs;
    CREATE POLICY notification_logs_select ON public.notification_logs FOR SELECT
      USING (organization_id IS NULL OR organization_id = public.get_user_org_id());
    CREATE POLICY notification_logs_mutate ON public.notification_logs FOR ALL
      USING (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()))
      WITH CHECK (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()));
  END IF;
END $$;

-- sales_reports
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='sales_reports') THEN
    DROP POLICY IF EXISTS sales_reports_select ON public.sales_reports;
    DROP POLICY IF EXISTS sales_reports_mutate ON public.sales_reports;
    CREATE POLICY sales_reports_select ON public.sales_reports FOR SELECT
      USING (organization_id IS NULL OR organization_id = public.get_user_org_id());
    CREATE POLICY sales_reports_mutate ON public.sales_reports FOR ALL
      USING (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()))
      WITH CHECK (organization_id IS NULL OR (organization_id = public.get_user_org_id() AND public.is_org_admin()));
  END IF;
END $$;

-- user_profiles: see own org members + own row; no admin bypass
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_mutate ON public.user_profiles;

CREATE POLICY user_profiles_select ON public.user_profiles FOR SELECT
  USING (organization_id = public.get_user_org_id() OR id = auth.uid());

CREATE POLICY user_profiles_mutate ON public.user_profiles FOR ALL
  USING (id = auth.uid() OR (organization_id = public.get_user_org_id() AND public.is_org_admin()))
  WITH CHECK (id = auth.uid() OR (organization_id = public.get_user_org_id() AND public.is_org_admin()));

-- organizations: only own org (no admin bypass, no is_demo bypass)
DROP POLICY IF EXISTS org_select_own ON public.organizations;
DROP POLICY IF EXISTS org_admin_all  ON public.organizations;

CREATE POLICY org_select_own ON public.organizations FOR SELECT
  USING (id = public.get_user_org_id());

CREATE POLICY org_mutate_own ON public.organizations FOR ALL
  USING (id = public.get_user_org_id() AND public.is_org_admin())
  WITH CHECK (id = public.get_user_org_id() AND public.is_org_admin());

-- ----------------------------------------------------------------------------
-- 2. invite_codes table (controls who can create a new org)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code        text        NOT NULL UNIQUE,
  notes       text,
  is_active   boolean     NOT NULL DEFAULT true,
  used_at     timestamptz,
  used_by_org_id uuid     REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: no public access — only service_role can read/write
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- No policies → only service_role (which bypasses RLS) can access
-- Regular authenticated users cannot read or enumerate codes

-- Grant to service role only (already has full access, but explicit for clarity)
GRANT SELECT, INSERT, UPDATE ON public.invite_codes TO service_role;
