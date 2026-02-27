-- 00032_update_products_catalog_view.sql
-- Add unit_price to products_catalog view

CREATE OR REPLACE VIEW products_catalog AS
  SELECT
    id,
    name,
    official_name,
    short_name,
    is_active,
    standard_code,
    COALESCE(mfds_source_type, 'unknown') AS source_type,
    unit_price
  FROM products
UNION ALL
  SELECT
    -1 * id AS id,
    item_name AS name,
    item_name AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    bar_code AS standard_code,
    'drug' AS source_type,
    unit_price
  FROM my_drugs
  WHERE bar_code NOT IN (SELECT standard_code FROM products WHERE standard_code IS NOT NULL)
UNION ALL
  SELECT
    -1000000 - id AS id,
    prdlst_nm AS name,
    prdlst_nm AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    udidi_cd AS standard_code,
    'device_std' AS source_type,
    unit_price
  FROM my_devices
  WHERE udidi_cd NOT IN (SELECT standard_code FROM products WHERE standard_code IS NOT NULL);
