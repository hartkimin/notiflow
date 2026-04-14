-- ============================================================================
-- Migration: 00076_fix_remaining_rls_leaks.sql
-- Description:
--   Fix all remaining tables that expose cross-org data to authenticated users.
--   Every table becomes org-scoped (directly or via FK chain).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_settings — add organization_id, replace open policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "authenticated_select"  ON public.company_settings;
DROP POLICY IF EXISTS "service_role_all"       ON public.company_settings;

CREATE POLICY company_settings_select ON public.company_settings FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY company_settings_mutate ON public.company_settings FOR ALL
  USING  (organization_id = public.get_user_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.get_user_org_id() AND public.is_org_admin());

-- ----------------------------------------------------------------------------
-- 2. audit_logs — org-scope via changed_by ∈ same-org user_profiles
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Viewer read audit_logs"           ON public.audit_logs;

CREATE POLICY audit_logs_org_select ON public.audit_logs FOR SELECT
  USING (
    changed_by IN (
      SELECT id FROM public.user_profiles
      WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY audit_logs_org_insert ON public.audit_logs FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. mobile_devices — replace role-based policies with org-scoped ones
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_all_mobile_devices"    ON public.mobile_devices;
DROP POLICY IF EXISTS "viewer_select_mobile_devices" ON public.mobile_devices;

-- SELECT: any member of the same org can view
CREATE POLICY mobile_devices_org_select ON public.mobile_devices FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.user_profiles
      WHERE organization_id = public.get_user_org_id()
    )
  );

-- ALL (mutate): org admin or own device
CREATE POLICY mobile_devices_org_mutate ON public.mobile_devices FOR ALL
  USING (
    user_id = auth.uid()
    OR (
      public.is_org_admin()
      AND user_id IN (
        SELECT id FROM public.user_profiles
        WHERE organization_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      public.is_org_admin()
      AND user_id IN (
        SELECT id FROM public.user_profiles
        WHERE organization_id = public.get_user_org_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. partner_products — org-scoped via hospital/supplier FK
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated full access for partner_products" ON public.partner_products;
DROP POLICY IF EXISTS "Allow public read for partner_products"                ON public.partner_products;

CREATE POLICY partner_products_select ON public.partner_products FOR SELECT
  USING (
    (partner_type = 'hospital' AND partner_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    ))
    OR
    (partner_type = 'supplier' AND partner_id IN (
      SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()
    ))
  );

CREATE POLICY partner_products_mutate ON public.partner_products FOR ALL
  USING (
    public.is_org_admin() AND (
      (partner_type = 'hospital' AND partner_id IN (
        SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
      ))
      OR
      (partner_type = 'supplier' AND partner_id IN (
        SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()
      ))
    )
  )
  WITH CHECK (
    public.is_org_admin() AND (
      (partner_type = 'hospital' AND partner_id IN (
        SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
      ))
      OR
      (partner_type = 'supplier' AND partner_id IN (
        SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()
      ))
    )
  );

-- ----------------------------------------------------------------------------
-- 5. partner_product_aliases — org-scoped via partner_products
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated full access for partner_product_aliases" ON public.partner_product_aliases;
DROP POLICY IF EXISTS "Allow public read for partner_product_aliases"                ON public.partner_product_aliases;

CREATE POLICY partner_product_aliases_select ON public.partner_product_aliases FOR SELECT
  USING (
    partner_product_id IN (
      SELECT pp.id FROM public.partner_products pp
      WHERE
        (pp.partner_type = 'hospital' AND pp.partner_id IN (
          SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
        ))
        OR
        (pp.partner_type = 'supplier' AND pp.partner_id IN (
          SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()
        ))
    )
  );

CREATE POLICY partner_product_aliases_mutate ON public.partner_product_aliases FOR ALL
  USING (
    public.is_org_admin() AND partner_product_id IN (
      SELECT pp.id FROM public.partner_products pp
      WHERE
        (pp.partner_type = 'hospital' AND pp.partner_id IN (
          SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
        ))
        OR
        (pp.partner_type = 'supplier' AND pp.partner_id IN (
          SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()
        ))
    )
  )
  WITH CHECK (
    public.is_org_admin() AND partner_product_id IN (
      SELECT pp.id FROM public.partner_products pp
      WHERE
        (pp.partner_type = 'hospital' AND pp.partner_id IN (
          SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
        ))
        OR
        (pp.partner_type = 'supplier' AND pp.partner_id IN (
          SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()
        ))
    )
  );

-- ----------------------------------------------------------------------------
-- 6. hospital_products — org-scoped via hospital_id
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can delete hospital_products" ON public.hospital_products;
DROP POLICY IF EXISTS "Authenticated users can insert hospital_products" ON public.hospital_products;
DROP POLICY IF EXISTS "Authenticated users can read hospital_products"   ON public.hospital_products;
DROP POLICY IF EXISTS "Authenticated users can update hospital_products" ON public.hospital_products;

CREATE POLICY hospital_products_select ON public.hospital_products FOR SELECT
  USING (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY hospital_products_mutate ON public.hospital_products FOR ALL
  USING (
    public.is_org_admin()
    AND hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    public.is_org_admin()
    AND hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. order_comments — org-scoped via order_id; own comments for insert/delete
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert order comments" ON public.order_comments;
DROP POLICY IF EXISTS "Authenticated users can read order comments"   ON public.order_comments;
DROP POLICY IF EXISTS "Users can delete own comments"                 ON public.order_comments;

CREATE POLICY order_comments_select ON public.order_comments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY order_comments_insert ON public.order_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND order_id IN (
      SELECT id FROM public.orders WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY order_comments_delete ON public.order_comments FOR DELETE
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 8. order_forecasts — org-scoped via hospital_id
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_forecasts_all" ON public.order_forecasts;

CREATE POLICY order_forecasts_select ON public.order_forecasts FOR SELECT
  USING (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY order_forecasts_mutate ON public.order_forecasts FOR ALL
  USING (
    public.is_org_admin()
    AND hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    public.is_org_admin()
    AND hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 9. order_patterns — org-scoped via hospital_id
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_order_patterns_all" ON public.order_patterns;

CREATE POLICY order_patterns_select ON public.order_patterns FOR SELECT
  USING (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY order_patterns_mutate ON public.order_patterns FOR ALL
  USING (
    public.is_org_admin()
    AND hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    public.is_org_admin()
    AND hospital_id IN (
      SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 10. forecast_items — org-scoped via forecast_id → order_forecasts → hospital_id
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_forecast_items_all" ON public.forecast_items;

CREATE POLICY forecast_items_select ON public.forecast_items FOR SELECT
  USING (
    forecast_id IN (
      SELECT f.id FROM public.order_forecasts f
      WHERE f.hospital_id IN (
        SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
      )
    )
  );

CREATE POLICY forecast_items_mutate ON public.forecast_items FOR ALL
  USING (
    public.is_org_admin()
    AND forecast_id IN (
      SELECT f.id FROM public.order_forecasts f
      WHERE f.hospital_id IN (
        SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_org_admin()
    AND forecast_id IN (
      SELECT f.id FROM public.order_forecasts f
      WHERE f.hospital_id IN (
        SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 11. order_embeddings — enable RLS, org-scoped via order_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_embeddings_select ON public.order_embeddings FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY order_embeddings_mutate ON public.order_embeddings FOR ALL
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders WHERE organization_id = public.get_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 12. partner_embeddings — enable RLS, org-scoped via partner_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.partner_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY partner_embeddings_select ON public.partner_embeddings FOR SELECT
  USING (
    (partner_id IN (SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()))
    OR
    (partner_id IN (SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()))
  );

CREATE POLICY partner_embeddings_mutate ON public.partner_embeddings FOR ALL
  USING (
    (partner_id IN (SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()))
    OR
    (partner_id IN (SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()))
  )
  WITH CHECK (
    (partner_id IN (SELECT id FROM public.hospitals WHERE organization_id = public.get_user_org_id()))
    OR
    (partner_id IN (SELECT id FROM public.suppliers WHERE organization_id = public.get_user_org_id()))
  );

-- ----------------------------------------------------------------------------
-- 13. product_embeddings — enable RLS, org-scoped via product_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.product_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_embeddings_select ON public.product_embeddings FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM public.products WHERE organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY product_embeddings_mutate ON public.product_embeddings FOR ALL
  USING (
    product_id IN (
      SELECT id FROM public.products WHERE organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.products WHERE organization_id = public.get_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 14. archived_messages — fix admin-only policy
--     No org_id: scope via audit trail. Keep admin-accessible but restrict to
--     messages from own org's hospitals/orders. For now: disable the blanket
--     admin bypass; use service_role for archive operations.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can view archived messages" ON public.archived_messages;

-- No public policy: service_role (server-side) handles archiving
-- Regular users cannot read archived_messages via client

-- ----------------------------------------------------------------------------
-- 15. my_drugs / my_devices — add organization_id for org isolation
-- ----------------------------------------------------------------------------
ALTER TABLE public.my_drugs   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.my_devices ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

DROP POLICY IF EXISTS "authenticated_all_my_drugs"   ON public.my_drugs;
DROP POLICY IF EXISTS "authenticated_all_my_devices" ON public.my_devices;

CREATE POLICY my_drugs_select ON public.my_drugs FOR SELECT
  USING (organization_id = public.get_user_org_id());
CREATE POLICY my_drugs_mutate ON public.my_drugs FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY my_devices_select ON public.my_devices FOR SELECT
  USING (organization_id = public.get_user_org_id());
CREATE POLICY my_devices_mutate ON public.my_devices FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());
