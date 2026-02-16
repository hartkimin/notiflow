-- ============================================================
-- Migration: 00003_stats_functions.sql
-- Description: PostgreSQL RPC functions for dashboard statistics
-- Functions:
--   1. get_daily_stats    - message/order counts for a single day
--   2. get_calendar_stats - per-day breakdown for an entire month
--   3. get_sales_report   - detailed sales report with line items
-- ============================================================

-- ============================================================
-- 1. get_daily_stats(target_date DATE)
--    Returns JSON with message counts, parse success, and order counts
--    for the given date (defaults to today).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_stats(
  target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'date',               target_date::TEXT,
    'total_messages',     (
      SELECT COUNT(*)
      FROM raw_messages
      WHERE received_at::DATE = target_date
    ),
    'parse_success',      (
      SELECT COUNT(*)
      FROM raw_messages
      WHERE received_at::DATE = target_date
        AND parse_status = 'parsed'
    ),
    'orders_created',     (
      SELECT COUNT(*)
      FROM orders
      WHERE order_date = target_date
    ),
    'parse_success_rate', (
      SELECT CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE parse_status = 'parsed')::NUMERIC
          / COUNT(*)::NUMERIC * 100
        )
      END
      FROM raw_messages
      WHERE received_at::DATE = target_date
    )
  );
$$;

-- ============================================================
-- 2. get_calendar_stats(target_month TEXT)
--    target_month format: 'YYYY-MM' (e.g. '2026-02')
--    Returns JSON with month and array of daily stats including
--    message_count, order_count, and total_amount for each day.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_calendar_stats(
  target_month TEXT
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH month_days AS (
    SELECT d::DATE AS day
    FROM generate_series(
      (target_month || '-01')::DATE,
      ((target_month || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      '1 day'::INTERVAL
    ) AS d
  ),
  daily_messages AS (
    SELECT
      received_at::DATE AS day,
      COUNT(*) AS message_count
    FROM raw_messages
    WHERE received_at::DATE >= (target_month || '-01')::DATE
      AND received_at::DATE < (target_month || '-01')::DATE + INTERVAL '1 month'
    GROUP BY received_at::DATE
  ),
  daily_orders AS (
    SELECT
      order_date AS day,
      COUNT(*) AS order_count,
      COALESCE(SUM(total_amount), 0) AS total_amount
    FROM orders
    WHERE order_date >= (target_month || '-01')::DATE
      AND order_date < (target_month || '-01')::DATE + INTERVAL '1 month'
    GROUP BY order_date
  )
  SELECT json_build_object(
    'month', target_month,
    'days',  COALESCE(
      json_agg(
        json_build_object(
          'date',          md.day::TEXT,
          'message_count', COALESCE(dm.message_count, 0),
          'order_count',   COALESCE(do2.order_count, 0),
          'total_amount',  COALESCE(do2.total_amount, 0)
        )
        ORDER BY md.day
      ),
      '[]'::JSON
    )
  )
  FROM month_days md
  LEFT JOIN daily_messages dm ON dm.day = md.day
  LEFT JOIN daily_orders do2  ON do2.day = md.day;
$$;

-- ============================================================
-- 3. get_sales_report(target_period TEXT)
--    target_period format: 'YYYY-MM' (e.g. '2026-02')
--    Returns JSON with period, detailed rows (order + item + product
--    + hospital + supplier), and a summary object.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sales_report(
  target_period TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  WITH report_rows AS (
    SELECT
      o.order_number,
      h.name              AS hospital_name,
      h.business_number,
      h.address,
      p.name              AS product_name,
      p.standard_code,
      s.name              AS supplier_name,
      oi.quantity,
      oi.unit_price,
      COALESCE(oi.line_total, oi.quantity * oi.unit_price)  AS supply_amount,
      ROUND(
        COALESCE(oi.line_total, oi.quantity * oi.unit_price) * 0.1, 0
      )                   AS tax_amount
    FROM orders o
    JOIN order_items oi   ON oi.order_id   = o.id
    LEFT JOIN products p  ON p.id          = oi.product_id
    LEFT JOIN hospitals h ON h.id          = o.hospital_id
    LEFT JOIN suppliers s ON s.id          = oi.supplier_id
    WHERE o.order_date >= (target_period || '-01')::DATE
      AND o.order_date <  (target_period || '-01')::DATE + INTERVAL '1 month'
    ORDER BY o.order_date, o.order_number
  )
  SELECT json_build_object(
    'period',  target_period,
    'rows',    COALESCE((SELECT json_agg(
      json_build_object(
        'order_number',   rr.order_number,
        'hospital_name',  rr.hospital_name,
        'business_number', rr.business_number,
        'address',        rr.address,
        'product_name',   rr.product_name,
        'standard_code',  rr.standard_code,
        'supplier_name',  rr.supplier_name,
        'quantity',       rr.quantity,
        'unit_price',     rr.unit_price,
        'supply_amount',  rr.supply_amount,
        'tax_amount',     rr.tax_amount
      )
    ) FROM report_rows rr), '[]'::JSON),
    'summary', json_build_object(
      'total_orders', (
        SELECT COUNT(DISTINCT o.id)
        FROM orders o
        WHERE o.order_date >= (target_period || '-01')::DATE
          AND o.order_date <  (target_period || '-01')::DATE + INTERVAL '1 month'
      ),
      'total_items', (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date >= (target_period || '-01')::DATE
          AND o.order_date <  (target_period || '-01')::DATE + INTERVAL '1 month'
      ),
      'total_supply', (
        SELECT COALESCE(SUM(
          COALESCE(oi.line_total, oi.quantity * oi.unit_price)
        ), 0)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date >= (target_period || '-01')::DATE
          AND o.order_date <  (target_period || '-01')::DATE + INTERVAL '1 month'
      ),
      'total_tax', (
        SELECT COALESCE(SUM(
          ROUND(COALESCE(oi.line_total, oi.quantity * oi.unit_price) * 0.1, 0)
        ), 0)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date >= (target_period || '-01')::DATE
          AND o.order_date <  (target_period || '-01')::DATE + INTERVAL '1 month'
      ),
      'total_amount', (
        SELECT COALESCE(SUM(
          COALESCE(oi.line_total, oi.quantity * oi.unit_price)
          + ROUND(COALESCE(oi.line_total, oi.quantity * oi.unit_price) * 0.1, 0)
        ), 0)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date >= (target_period || '-01')::DATE
          AND o.order_date <  (target_period || '-01')::DATE + INTERVAL '1 month'
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;
