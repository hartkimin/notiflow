-- Enable Supabase Realtime for dashboard tables
-- Supabase requires tables to be added to the `supabase_realtime` publication
-- for postgres_changes channels to work.

ALTER PUBLICATION supabase_realtime ADD TABLE
  orders,
  order_items,
  raw_messages,
  hospitals,
  products,
  product_aliases,
  suppliers,
  kpis_reports,
  user_profiles;
