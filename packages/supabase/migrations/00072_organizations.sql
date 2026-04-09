-- ============================================================================
-- Migration: 00072_organizations.sql
-- Description: Multi-tenant SaaS conversion — organizations table
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
CREATE TABLE public.organizations (
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

CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_active ON public.organizations(is_active);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Insert default organization from company_settings
--    company_settings has exactly one row; use its company_name if non-empty
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id   UUID;
  v_name     TEXT;
  v_biz_no   TEXT;
BEGIN
  SELECT
    COALESCE(NULLIF(TRIM(company_name), ''), 'My Organization'),
    COALESCE(NULLIF(TRIM(biz_no), ''), NULL)
  INTO v_name, v_biz_no
  FROM public.company_settings
  LIMIT 1;

  -- If company_settings doesn't exist yet, use a fallback
  IF v_name IS NULL THEN
    v_name := 'My Organization';
  END IF;

  -- Generate a slug from the name
  INSERT INTO public.organizations (name, slug, biz_no, plan)
  VALUES (
    v_name,
    regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'),
    v_biz_no,
    'pro'  -- existing customer gets pro
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  -- Store the default org id for use in subsequent steps
  -- We'll reference it via a temp table
  CREATE TEMP TABLE _default_org (id UUID);
  INSERT INTO _default_org VALUES (v_org_id);
END $$;

-- ----------------------------------------------------------------------------
-- 3. Add organization_id column (nullable first for safe backfill)
-- ----------------------------------------------------------------------------

-- Core business tables
ALTER TABLE public.hospitals         ADD COLUMN organization_id UUID;
ALTER TABLE public.products          ADD COLUMN organization_id UUID;
ALTER TABLE public.product_aliases   ADD COLUMN organization_id UUID;
ALTER TABLE public.product_box_specs ADD COLUMN organization_id UUID;
ALTER TABLE public.suppliers         ADD COLUMN organization_id UUID;
ALTER TABLE public.product_suppliers ADD COLUMN organization_id UUID;
ALTER TABLE public.orders            ADD COLUMN organization_id UUID;
ALTER TABLE public.order_items       ADD COLUMN organization_id UUID;
ALTER TABLE public.raw_messages      ADD COLUMN organization_id UUID;
ALTER TABLE public.parse_history     ADD COLUMN organization_id UUID;
ALTER TABLE public.notification_logs ADD COLUMN organization_id UUID;
ALTER TABLE public.kpis_reports      ADD COLUMN organization_id UUID;
ALTER TABLE public.sales_reports     ADD COLUMN organization_id UUID;
ALTER TABLE public.settings          ADD COLUMN organization_id UUID;

-- Tax invoice tables (added in migration 00053)
ALTER TABLE public.tax_invoices       ADD COLUMN organization_id UUID;
ALTER TABLE public.tax_invoice_items  ADD COLUMN organization_id UUID;
ALTER TABLE public.tax_invoice_orders ADD COLUMN organization_id UUID;

-- user_profiles: which org they belong to + org-level role
ALTER TABLE public.user_profiles ADD COLUMN organization_id UUID;
ALTER TABLE public.user_profiles ADD COLUMN org_role VARCHAR(20) NOT NULL DEFAULT 'member';
-- org_role: owner | admin | member

-- ----------------------------------------------------------------------------
-- 4. Backfill all existing rows with the default org id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM _default_org LIMIT 1;

  UPDATE public.hospitals         SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.products          SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.product_aliases   SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.product_box_specs SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.suppliers         SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.product_suppliers SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.orders            SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.order_items       SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.raw_messages      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.parse_history     SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.notification_logs SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.kpis_reports      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.sales_reports     SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.settings          SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.tax_invoices      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.tax_invoice_items SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.tax_invoice_orders SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.user_profiles     SET organization_id = v_org_id, org_role = 'owner' WHERE organization_id IS NULL;
END $$;

-- Drop the temp table
DROP TABLE _default_org;

-- ----------------------------------------------------------------------------
-- 5. Add NOT NULL constraints + FK references
-- ----------------------------------------------------------------------------

-- Business tables
ALTER TABLE public.hospitals
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_hospitals_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.products
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_products_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.product_aliases
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_product_aliases_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.product_box_specs
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_product_box_specs_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.suppliers
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_suppliers_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.product_suppliers
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_product_suppliers_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.orders
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_orders_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.order_items
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_order_items_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.raw_messages
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_raw_messages_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.parse_history
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_parse_history_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- notification_logs: nullable org_id — edge function webhook logs don't always have org context
ALTER TABLE public.notification_logs
  ADD CONSTRAINT fk_notification_logs_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.kpis_reports
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_kpis_reports_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- sales_reports: nullable org_id — cron-generated aggregate reports don't have a single org context
ALTER TABLE public.sales_reports
  ADD CONSTRAINT fk_sales_reports_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.settings
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_settings_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tax_invoices
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_tax_invoices_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tax_invoice_items
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_tax_invoice_items_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tax_invoice_orders
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_tax_invoice_orders_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- user_profiles org FK (nullable: system users without an org)
ALTER TABLE public.user_profiles
  ADD CONSTRAINT fk_user_profiles_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 6. Indexes for org-scoped queries
-- ----------------------------------------------------------------------------
CREATE INDEX idx_hospitals_org         ON public.hospitals(organization_id);
CREATE INDEX idx_products_org          ON public.products(organization_id);
CREATE INDEX idx_product_aliases_org   ON public.product_aliases(organization_id);
CREATE INDEX idx_suppliers_org         ON public.suppliers(organization_id);
CREATE INDEX idx_orders_org            ON public.orders(organization_id);
CREATE INDEX idx_order_items_org       ON public.order_items(organization_id);
CREATE INDEX idx_raw_messages_org      ON public.raw_messages(organization_id);
CREATE INDEX idx_parse_history_org     ON public.parse_history(organization_id);
CREATE INDEX idx_notification_logs_org ON public.notification_logs(organization_id);
CREATE INDEX idx_kpis_reports_org      ON public.kpis_reports(organization_id);
CREATE INDEX idx_sales_reports_org     ON public.sales_reports(organization_id);
CREATE INDEX idx_tax_invoices_org      ON public.tax_invoices(organization_id);
CREATE INDEX idx_user_profiles_org     ON public.user_profiles(organization_id);

-- ----------------------------------------------------------------------------
-- 7. Helper functions for org resolution
-- ----------------------------------------------------------------------------

-- Get the organization_id for the current user
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the org-level role for the current user (owner | admin | member)
CREATE OR REPLACE FUNCTION public.get_user_org_role()
RETURNS TEXT AS $$
  SELECT org_role
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if a user is an org admin or owner
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT org_role IN ('owner', 'admin')
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 8. Demo organization seed (sandboxed, read-only)
-- ----------------------------------------------------------------------------
INSERT INTO public.organizations (name, slug, plan, is_demo, is_active, max_users)
VALUES ('NotiFlow 데모', 'demo', 'pro', true, true, 999)
ON CONFLICT (slug) DO NOTHING;
