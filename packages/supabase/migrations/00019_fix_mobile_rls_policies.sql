-- ============================================================
-- Migration: 00019_fix_mobile_rls_policies.sql
-- Description: Ensure RLS policies exist for all mobile sync
--   tables. The DO block in 00010 may have failed silently,
--   leaving RLS enabled but no policies → all INSERTs denied.
--   This migration is idempotent (IF NOT EXISTS check).
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'categories','status_steps','filter_rules',
    'captured_messages','app_filters','plans','day_categories'
  ]
  LOOP
    pol := 'Users manage own ' || tbl;

    -- Ensure RLS is enabled (idempotent)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Create policy only if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        pol, tbl
      );
      RAISE NOTICE 'Created missing RLS policy: % on %', pol, tbl;
    END IF;
  END LOOP;
END
$$;
