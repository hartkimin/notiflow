-- ============================================================================
-- Migration: 00073_rls_organizations.sql
-- Description: Update RLS policies for multi-tenant org-scoped access
--
-- New model:
--   - Every row is scoped to an organization_id
--   - Users see ONLY data from their own organization
--   - Org admin/owner: full CRUD within their org
--   - Org member: read-only within their org
--   - System role 'app' (Android device): INSERT raw_messages for their org
--   - System role 'admin' (super-admin): access all orgs (kept for ops)
--   - Demo org: read-only for all authenticated users
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop all existing role-based policies from migration 00002
--    We replace them with org-scoped equivalents.
-- ----------------------------------------------------------------------------

-- hospitals
DROP POLICY IF EXISTS admin_all_hospitals       ON public.hospitals;
DROP POLICY IF EXISTS viewer_select_hospitals   ON public.hospitals;

-- products
DROP POLICY IF EXISTS admin_all_products        ON public.products;
DROP POLICY IF EXISTS viewer_select_products    ON public.products;

-- product_aliases
DROP POLICY IF EXISTS admin_all_product_aliases     ON public.product_aliases;
DROP POLICY IF EXISTS viewer_select_product_aliases ON public.product_aliases;

-- product_box_specs
DROP POLICY IF EXISTS admin_all_product_box_specs     ON public.product_box_specs;
DROP POLICY IF EXISTS viewer_select_product_box_specs ON public.product_box_specs;

-- suppliers
DROP POLICY IF EXISTS admin_all_suppliers        ON public.suppliers;
DROP POLICY IF EXISTS viewer_select_suppliers    ON public.suppliers;

-- product_suppliers
DROP POLICY IF EXISTS admin_all_product_suppliers     ON public.product_suppliers;
DROP POLICY IF EXISTS viewer_select_product_suppliers ON public.product_suppliers;

-- raw_messages
DROP POLICY IF EXISTS admin_all_raw_messages     ON public.raw_messages;
DROP POLICY IF EXISTS viewer_select_raw_messages ON public.raw_messages;
DROP POLICY IF EXISTS app_insert_raw_messages    ON public.raw_messages;

-- orders
DROP POLICY IF EXISTS admin_all_orders           ON public.orders;
DROP POLICY IF EXISTS viewer_select_orders       ON public.orders;

-- order_items
DROP POLICY IF EXISTS admin_all_order_items      ON public.order_items;
DROP POLICY IF EXISTS viewer_select_order_items  ON public.order_items;

-- parse_history
DROP POLICY IF EXISTS admin_all_parse_history     ON public.parse_history;
DROP POLICY IF EXISTS viewer_select_parse_history ON public.parse_history;

-- notification_logs
DROP POLICY IF EXISTS admin_all_notification_logs     ON public.notification_logs;
DROP POLICY IF EXISTS viewer_select_notification_logs ON public.notification_logs;

-- kpis_reports
DROP POLICY IF EXISTS admin_all_kpis_reports     ON public.kpis_reports;
DROP POLICY IF EXISTS viewer_select_kpis_reports ON public.kpis_reports;

-- sales_reports
DROP POLICY IF EXISTS admin_all_sales_reports     ON public.sales_reports;
DROP POLICY IF EXISTS viewer_select_sales_reports ON public.sales_reports;

-- user_profiles
DROP POLICY IF EXISTS admin_all_user_profiles     ON public.user_profiles;
DROP POLICY IF EXISTS viewer_select_own_profile   ON public.user_profiles;

-- settings
DROP POLICY IF EXISTS admin_all_settings ON public.settings;

-- ----------------------------------------------------------------------------
-- 2. Update get_user_role() to also inject org context into JWT hook
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update auth hook to also include org_id and org_role
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims       JSONB;
  user_role    TEXT;
  org_id       UUID;
  org_role     TEXT;
BEGIN
  claims := event->'claims';

  SELECT
    up.role,
    up.organization_id,
    up.org_role
  INTO user_role, org_id, org_role
  FROM public.user_profiles up
  WHERE up.id = (event->>'user_id')::UUID;

  claims := jsonb_set(claims, '{user_role}',   to_jsonb(COALESCE(user_role, 'viewer')));
  claims := jsonb_set(claims, '{org_id}',      to_jsonb(org_id));
  claims := jsonb_set(claims, '{org_role}',    to_jsonb(COALESCE(org_role, 'member')));
  event  := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. organizations table policies
-- ----------------------------------------------------------------------------

-- Any authenticated user can see their own org
CREATE POLICY org_select_own
  ON public.organizations FOR SELECT
  USING (
    id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR is_demo = true
  );

-- Only super-admin can manage orgs (org creation handled via service role in signup flow)
CREATE POLICY org_admin_all
  ON public.organizations FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 4. Macro: org-scoped policies for a business table
--
-- Pattern:
--   - Super-admin (role='admin'): full access to everything
--   - Demo org data: SELECT only for all authenticated users
--   - Org admin/owner: full CRUD within their org
--   - Org member: SELECT within their org
-- ----------------------------------------------------------------------------

-- ── hospitals ──────────────────────────────────────────────────────────────
CREATE POLICY hospitals_select
  ON public.hospitals FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = hospitals.organization_id AND is_demo = true)
  );

CREATE POLICY hospitals_mutate
  ON public.hospitals FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── products ───────────────────────────────────────────────────────────────
CREATE POLICY products_select
  ON public.products FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = products.organization_id AND is_demo = true)
  );

CREATE POLICY products_mutate
  ON public.products FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── product_aliases ────────────────────────────────────────────────────────
CREATE POLICY product_aliases_select
  ON public.product_aliases FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = product_aliases.organization_id AND is_demo = true)
  );

CREATE POLICY product_aliases_mutate
  ON public.product_aliases FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── product_box_specs ──────────────────────────────────────────────────────
CREATE POLICY product_box_specs_select
  ON public.product_box_specs FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = product_box_specs.organization_id AND is_demo = true)
  );

CREATE POLICY product_box_specs_mutate
  ON public.product_box_specs FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── suppliers ──────────────────────────────────────────────────────────────
CREATE POLICY suppliers_select
  ON public.suppliers FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = suppliers.organization_id AND is_demo = true)
  );

CREATE POLICY suppliers_mutate
  ON public.suppliers FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── product_suppliers ──────────────────────────────────────────────────────
CREATE POLICY product_suppliers_select
  ON public.product_suppliers FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = product_suppliers.organization_id AND is_demo = true)
  );

CREATE POLICY product_suppliers_mutate
  ON public.product_suppliers FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── raw_messages ───────────────────────────────────────────────────────────
CREATE POLICY raw_messages_select
  ON public.raw_messages FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = raw_messages.organization_id AND is_demo = true)
  );

CREATE POLICY raw_messages_mutate
  ON public.raw_messages FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- Android app INSERT: role='app', must insert into their org
CREATE POLICY raw_messages_app_insert
  ON public.raw_messages FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'app'
    AND organization_id = public.get_user_org_id()
  );

-- ── orders ─────────────────────────────────────────────────────────────────
CREATE POLICY orders_select
  ON public.orders FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = orders.organization_id AND is_demo = true)
  );

CREATE POLICY orders_mutate
  ON public.orders FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── order_items ────────────────────────────────────────────────────────────
CREATE POLICY order_items_select
  ON public.order_items FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = order_items.organization_id AND is_demo = true)
  );

CREATE POLICY order_items_mutate
  ON public.order_items FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── parse_history ──────────────────────────────────────────────────────────
CREATE POLICY parse_history_select
  ON public.parse_history FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = parse_history.organization_id AND is_demo = true)
  );

CREATE POLICY parse_history_mutate
  ON public.parse_history FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── notification_logs ──────────────────────────────────────────────────────
-- organization_id is nullable here (webhook/edge function logs may lack user context)
CREATE POLICY notification_logs_select
  ON public.notification_logs FOR SELECT
  USING (
    organization_id IS NULL  -- system-level logs visible to org admins
    OR organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY notification_logs_mutate
  ON public.notification_logs FOR ALL
  USING (
    organization_id IS NULL
    OR (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    organization_id IS NULL
    OR (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── kpis_reports ───────────────────────────────────────────────────────────
CREATE POLICY kpis_reports_select
  ON public.kpis_reports FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = kpis_reports.organization_id AND is_demo = true)
  );

CREATE POLICY kpis_reports_mutate
  ON public.kpis_reports FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── sales_reports ──────────────────────────────────────────────────────────
-- organization_id is nullable (cron aggregate reports have no single org)
CREATE POLICY sales_reports_select
  ON public.sales_reports FOR SELECT
  USING (
    organization_id IS NULL  -- global aggregate reports
    OR organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY sales_reports_mutate
  ON public.sales_reports FOR ALL
  USING (
    organization_id IS NULL
    OR (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    organization_id IS NULL
    OR (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── settings ───────────────────────────────────────────────────────────────
CREATE POLICY settings_select
  ON public.settings FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY settings_mutate
  ON public.settings FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── tax_invoices ───────────────────────────────────────────────────────────
ALTER TABLE public.tax_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_invoice_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_invoices_select
  ON public.tax_invoices FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = tax_invoices.organization_id AND is_demo = true)
  );

CREATE POLICY tax_invoices_mutate
  ON public.tax_invoices FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY tax_invoice_items_select
  ON public.tax_invoice_items FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = tax_invoice_items.organization_id AND is_demo = true)
  );

CREATE POLICY tax_invoice_items_mutate
  ON public.tax_invoice_items FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY tax_invoice_orders_select
  ON public.tax_invoice_orders FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = tax_invoice_orders.organization_id AND is_demo = true)
  );

CREATE POLICY tax_invoice_orders_mutate
  ON public.tax_invoice_orders FOR ALL
  USING (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );

-- ── user_profiles ──────────────────────────────────────────────────────────
-- Users can see members of their own org
CREATE POLICY user_profiles_select
  ON public.user_profiles FOR SELECT
  USING (
    organization_id = public.get_user_org_id()
    OR id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- Only org admins can mutate other profiles in their org; users can edit their own
CREATE POLICY user_profiles_mutate
  ON public.user_profiles FOR ALL
  USING (
    id = auth.uid()
    OR (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR (organization_id = public.get_user_org_id() AND public.is_org_admin())
    OR public.get_user_role() = 'admin'
  );
