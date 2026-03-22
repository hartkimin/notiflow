-- Fix SECURITY DEFINER views to use SECURITY INVOKER
-- This ensures RLS policies of the querying user are enforced,
-- not those of the view creator (postgres superuser).

ALTER VIEW mfds_items_view SET (security_invoker = on);
ALTER VIEW products_catalog SET (security_invoker = on);
