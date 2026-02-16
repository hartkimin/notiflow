-- ============================================================
-- Migration: 00008_analytics_functions.sql
-- Description: Additional RPC functions for dashboard analytics
-- Functions:
--   1. get_hospital_stats  - per-hospital order/revenue summary
--   2. get_product_stats   - per-product order/quantity summary
--   3. get_trend_stats     - daily order/message trend over a date range
-- ============================================================

-- ============================================================
-- 1. get_hospital_stats(from_date, to_date)
--    Returns JSON array of hospital-level aggregations.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_hospital_stats(
  from_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  to_date   DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(json_agg(row_data ORDER BY total_amount DESC), '[]'::JSON)
  FROM (
    SELECT
      h.id                                          AS hospital_id,
      h.name                                        AS hospital_name,
      COUNT(DISTINCT o.id)                           AS order_count,
      COALESCE(SUM(oi.quantity), 0)::INT             AS item_count,
      COALESCE(SUM(COALESCE(oi.line_total, oi.quantity * oi.unit_price)), 0)::NUMERIC AS total_amount
    FROM hospitals h
    LEFT JOIN orders o ON o.hospital_id = h.id
      AND o.order_date BETWEEN from_date AND to_date
      AND o.status != 'cancelled'
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE h.is_active = true
    GROUP BY h.id, h.name
    HAVING COUNT(DISTINCT o.id) > 0
  ) row_data;
$$;

-- ============================================================
-- 2. get_product_stats(from_date, to_date)
--    Returns JSON array of product-level aggregations.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_product_stats(
  from_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  to_date   DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(json_agg(row_data ORDER BY total_quantity DESC), '[]'::JSON)
  FROM (
    SELECT
      p.id                                            AS product_id,
      p.name                                          AS product_name,
      p.category::TEXT                                 AS category,
      COUNT(DISTINCT o.id)                             AS order_count,
      COALESCE(SUM(oi.quantity), 0)::INT               AS total_quantity,
      COALESCE(SUM(COALESCE(oi.line_total, oi.quantity * oi.unit_price)), 0)::NUMERIC AS total_amount
    FROM products p
    JOIN order_items oi ON oi.product_id = p.id
    JOIN orders o ON o.id = oi.order_id
      AND o.order_date BETWEEN from_date AND to_date
      AND o.status != 'cancelled'
    WHERE p.is_active = true
    GROUP BY p.id, p.name, p.category
  ) row_data;
$$;

-- ============================================================
-- 3. get_trend_stats(from_date, to_date)
--    Returns JSON array of daily message/order/revenue data
--    for rendering trend charts.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_trend_stats(
  from_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  to_date   DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH date_series AS (
    SELECT d::DATE AS day
    FROM generate_series(from_date, to_date, '1 day'::INTERVAL) AS d
  ),
  daily_messages AS (
    SELECT received_at::DATE AS day, COUNT(*) AS cnt
    FROM raw_messages
    WHERE received_at::DATE BETWEEN from_date AND to_date
    GROUP BY received_at::DATE
  ),
  daily_orders AS (
    SELECT
      order_date AS day,
      COUNT(*) AS cnt,
      COALESCE(SUM(total_amount), 0) AS amount
    FROM orders
    WHERE order_date BETWEEN from_date AND to_date
      AND status != 'cancelled'
    GROUP BY order_date
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'date',          ds.day::TEXT,
        'messages',      COALESCE(dm.cnt, 0),
        'orders',        COALESCE(do2.cnt, 0),
        'total_amount',  COALESCE(do2.amount, 0)
      )
      ORDER BY ds.day
    ),
    '[]'::JSON
  )
  FROM date_series ds
  LEFT JOIN daily_messages dm ON dm.day = ds.day
  LEFT JOIN daily_orders do2  ON do2.day = ds.day;
$$;
