-- ============================================================================
-- Migration: 00072_organizations.sql
-- Description: Multi-tenant SaaS conversion — organizations table
--
-- Uses IF EXISTS / IF NOT EXISTS throughout so it is safe to run against
-- any database state (cloud may differ from local migrations baseline).
--
-- Strategy (zero data loss):
--   1. Create organizations table
--   2. Insert a default org from existing company_settings
--   3. Add organization_id (nullable) to all business tables
--   4. Backfill every existing row to the default org
--   5. Add NOT NULL + FK constraints
--   6. Add organization_id to user_profiles
--   7. Create helper functions for org resolution
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. organizations table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  biz_no          VARCHAR(20),
  plan            VARCHAR(20) NOT NULL DEFAULT 'free',  -- free | pro | enterprise
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  max_users       INTEGER NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug   ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Insert default organization from company_settings
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id   UUID;
  v_name     TEXT;
  v_biz_no   TEXT;
BEGIN
  -- Try to read from company_settings if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='company_settings') THEN
    SELECT
      COALESCE(NULLIF(TRIM(company_name), ''), 'My Organization'),
      COALESCE(NULLIF(TRIM(biz_no), ''), NULL)
    INTO v_name, v_biz_no
    FROM public.company_settings
    LIMIT 1;
  END IF;

  IF v_name IS NULL THEN
    v_name := 'My Organization';
  END IF;

  INSERT INTO public.organizations (name, slug, biz_no, plan)
  VALUES (
    v_name,
    regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'),
    v_biz_no,
    'pro'
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  CREATE TEMP TABLE _default_org (id UUID);
  INSERT INTO _default_org VALUES (v_org_id);
END $$;

-- ----------------------------------------------------------------------------
-- 3. Add organization_id column (IF NOT EXISTS — safe to re-run)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'hospitals','products','product_aliases','product_box_specs',
    'suppliers','product_suppliers','orders','order_items',
    'raw_messages','parse_history','notification_logs','kpis_reports',
    'sales_reports','settings','tax_invoices','tax_invoice_items',
    'tax_invoice_orders'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id UUID', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- user_profiles columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='organization_id') THEN
    ALTER TABLE public.user_profiles ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='org_role') THEN
    ALTER TABLE public.user_profiles ADD COLUMN org_role VARCHAR(20) NOT NULL DEFAULT 'member';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Backfill all existing rows with the default org id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id UUID;
  tables TEXT[] := ARRAY[
    'hospitals','products','product_aliases','product_box_specs',
    'suppliers','product_suppliers','orders','order_items',
    'raw_messages','parse_history','notification_logs','kpis_reports',
    'sales_reports','settings','tax_invoices','tax_invoice_items',
    'tax_invoice_orders'
  ];
  t TEXT;
BEGIN
  SELECT id INTO v_org_id FROM _default_org LIMIT 1;

  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') THEN
        EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', t) USING v_org_id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.user_profiles
    SET organization_id = v_org_id, org_role = 'owner'
  WHERE organization_id IS NULL;
END $$;

DROP TABLE _default_org;

-- ----------------------------------------------------------------------------
-- 5. Add NOT NULL constraints + FK references (only where column exists and
--    table has rows — skip tables that were absent)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  -- tables that should have NOT NULL org_id
  nn_tables TEXT[] := ARRAY[
    'hospitals','products','product_aliases','product_box_specs',
    'suppliers','product_suppliers','orders','order_items',
    'raw_messages','parse_history','kpis_reports','settings',
    'tax_invoices','tax_invoice_items','tax_invoice_orders'
  ];
  -- tables where org_id stays nullable (system/cron context)
  nullable_tables TEXT[] := ARRAY['notification_logs','sales_reports'];
  t TEXT;
  fk_name TEXT;
BEGIN
  -- NOT NULL tables
  FOREACH t IN ARRAY nn_tables LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
    AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') THEN
      -- Set NOT NULL
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
      -- Add FK if not already there
      fk_name := 'fk_' || t || '_org';
      IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_schema='public' AND table_name=t AND constraint_name=fk_name) THEN
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE', t, fk_name);
      END IF;
    END IF;
  END LOOP;

  -- Nullable tables (just add FK without NOT NULL)
  FOREACH t IN ARRAY nullable_tables LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
    AND EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') THEN
      fk_name := 'fk_' || t || '_org';
      IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_schema='public' AND table_name=t AND constraint_name=fk_name) THEN
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL', t, fk_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- user_profiles org FK (nullable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='user_profiles' AND constraint_name='fk_user_profiles_org') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT fk_user_profiles_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Indexes for org-scoped queries
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  idx_defs TEXT[][] := ARRAY[
    ARRAY['idx_hospitals_org',          'hospitals',          'organization_id'],
    ARRAY['idx_products_org',           'products',           'organization_id'],
    ARRAY['idx_product_aliases_org',    'product_aliases',    'organization_id'],
    ARRAY['idx_suppliers_org',          'suppliers',          'organization_id'],
    ARRAY['idx_orders_org',             'orders',             'organization_id'],
    ARRAY['idx_order_items_org',        'order_items',        'organization_id'],
    ARRAY['idx_raw_messages_org',       'raw_messages',       'organization_id'],
    ARRAY['idx_parse_history_org',      'parse_history',      'organization_id'],
    ARRAY['idx_notification_logs_org',  'notification_logs',  'organization_id'],
    ARRAY['idx_kpis_reports_org',       'kpis_reports',       'organization_id'],
    ARRAY['idx_sales_reports_org',      'sales_reports',      'organization_id'],
    ARRAY['idx_tax_invoices_org',       'tax_invoices',       'organization_id'],
    ARRAY['idx_user_profiles_org',      'user_profiles',      'organization_id']
  ];
  d TEXT[];
BEGIN
  FOREACH d SLICE 1 IN ARRAY idx_defs LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=d[2])
    AND NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname='public' AND indexname=d[1]) THEN
      EXECUTE format('CREATE INDEX %I ON public.%I(%I)', d[1], d[2], d[3]);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Helper functions for org resolution
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_org_role()
RETURNS TEXT AS $$
  SELECT org_role
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT org_role IN ('owner', 'admin')
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 8. Demo organization seed
-- ----------------------------------------------------------------------------
INSERT INTO public.organizations (name, slug, plan, is_demo, is_active, max_users)
VALUES ('NotiFlow 데모', 'demo', 'pro', true, true, 999)
ON CONFLICT (slug) DO NOTHING;
