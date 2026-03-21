-- Fix overly permissive RLS policies
-- Forecast tables: restrict to authenticated users only
-- My drugs/devices: remove anonymous read access

-- ═══ 1. Forecast tables — restrict from public to authenticated ═══

DROP POLICY IF EXISTS "dashboard_forecasts_all" ON order_forecasts;
CREATE POLICY "authenticated_forecasts_all" ON order_forecasts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dashboard_forecast_items_all" ON forecast_items;
CREATE POLICY "authenticated_forecast_items_all" ON forecast_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dashboard_order_patterns_all" ON order_patterns;
CREATE POLICY "authenticated_order_patterns_all" ON order_patterns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══ 2. My drugs/devices — remove anonymous read, keep authenticated ═══

DROP POLICY IF EXISTS "read_my_drugs" ON my_drugs;
DROP POLICY IF EXISTS "read_my_devices" ON my_devices;
