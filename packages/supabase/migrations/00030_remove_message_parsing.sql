-- 00030_remove_message_parsing.sql
-- Remove message parsing infrastructure (keep AI connection settings)

-- 1. Drop FK constraint and column from orders
ALTER TABLE orders DROP COLUMN IF EXISTS message_id;

-- 2. Drop parsing columns from order_items
ALTER TABLE order_items DROP COLUMN IF EXISTS original_text;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_confidence;

-- 3. Drop raw_messages table (CASCADE drops dependent objects)
DROP TABLE IF EXISTS raw_messages CASCADE;

-- 4. Drop enum types used by parsing
DROP TYPE IF EXISTS match_status_enum;
DROP TYPE IF EXISTS parse_status_enum;

-- 5. Remove parsing-specific settings (keep AI connection keys)
DELETE FROM settings WHERE key IN (
  'ai_parse_prompt',
  'ai_auto_process',
  'ai_confidence_threshold'
);

-- 6. Fix get_daily_stats — remove raw_messages references
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
    'orders_created',     (
      SELECT COUNT(*)
      FROM orders
      WHERE order_date = target_date
        AND status != 'cancelled'
    )
  );
$$;

-- 7. Fix get_trend_stats — remove raw_messages references
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
        'orders',        COALESCE(do2.cnt, 0),
        'total_amount',  COALESCE(do2.amount, 0)
      )
      ORDER BY ds.day
    ),
    '[]'::JSON
  )
  FROM date_series ds
  LEFT JOIN daily_orders do2  ON do2.day = ds.day;
$$;

-- 8. Fix get_calendar_stats if it exists — remove raw_messages references
CREATE OR REPLACE FUNCTION public.get_calendar_stats(
  target_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM')
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH date_series AS (
    SELECT d::DATE AS day
    FROM generate_series(
      (target_month || '-01')::DATE,
      (target_month || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day',
      '1 day'::INTERVAL
    ) d
  ),
  daily_orders AS (
    SELECT order_date AS day, COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS amount
    FROM orders
    WHERE order_date >= (target_month || '-01')::DATE
      AND order_date < (target_month || '-01')::DATE + INTERVAL '1 month'
      AND status != 'cancelled'
    GROUP BY order_date
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'date',           ds.day::TEXT,
        'order_count',    COALESCE(do2.cnt, 0),
        'total_amount',   COALESCE(do2.amount, 0)
      )
      ORDER BY ds.day
    ),
    '[]'::JSON
  )
  FROM date_series ds
  LEFT JOIN daily_orders do2 ON do2.day = ds.day;
$$;
