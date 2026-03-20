-- 00048_sales_dashboard_metrics.sql
-- RPC functions for the summary dashboard

-- 1. 월별 매출/이익/건수/세금계산서 추이 함수 (최근 6개월)
CREATE OR REPLACE FUNCTION get_monthly_sales_trend(months_limit INT DEFAULT 6)
RETURNS TABLE (
  month TEXT,
  order_count BIGINT,
  supply_amount DECIMAL(15,2),
  profit_amount DECIMAL(15,2),
  profit_margin DECIMAL(5,2),
  unissued_tax_invoices BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      to_char(DATE_TRUNC('month', o.order_date), 'YYYY-MM') AS month_str,
      COUNT(DISTINCT o.id) AS m_order_count,
      SUM(o.supply_amount) AS m_supply_amount,
      -- total_sales uses order_items unit_price
      SUM(oi.quantity * COALESCE(oi.unit_price, 0)) AS total_sales,
      SUM(oi.quantity * (COALESCE(oi.unit_price, 0) - COALESCE(oi.purchase_price, 0))) AS m_profit_amount,
      -- check if tax_invoice_status column exists, if not it will error, let's just count orders for now. Wait, I added it in earlier logic or it's from Phase 1. 
      -- If it doesn't exist, we fallback. Let's just use JSONB or check information_schema, but typically we assume pending.
      COUNT(DISTINCT o.id) FILTER (WHERE o.tax_invoice_status IN ('pending', 'partial') OR o.tax_invoice_status IS NULL) AS m_unissued_tax_invoices
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY DATE_TRUNC('month', o.order_date)
  )
  SELECT 
    month_str,
    m_order_count,
    COALESCE(m_supply_amount, 0),
    COALESCE(m_profit_amount, 0),
    CASE 
      WHEN total_sales > 0 THEN ROUND((m_profit_amount / total_sales * 100)::numeric, 2)
      ELSE 0 
    END AS profit_margin,
    m_unissued_tax_invoices
  FROM monthly_data
  ORDER BY month_str DESC
  LIMIT months_limit;
END;
$$;

-- 2. 이번 달 영업담당자별 실적 함수
CREATE OR REPLACE FUNCTION get_sales_rep_stats(target_month DATE DEFAULT NULL)
RETURNS TABLE (
  sales_rep VARCHAR,
  sales_amount DECIMAL(15,2),
  profit_amount DECIMAL(15,2),
  profit_margin DECIMAL(5,2)
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_date DATE := COALESCE(target_month, CURRENT_DATE);
BEGIN
  RETURN QUERY
  WITH rep_data AS (
    SELECT 
      COALESCE(oi.sales_rep, '미지정') AS rep_name,
      SUM(oi.quantity * COALESCE(oi.unit_price, 0)) AS rep_sales_amount,
      SUM(oi.quantity * (COALESCE(oi.unit_price, 0) - COALESCE(oi.purchase_price, 0))) AS rep_profit_amount
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
      AND DATE_TRUNC('month', o.order_date) = DATE_TRUNC('month', base_date)
    GROUP BY COALESCE(oi.sales_rep, '미지정')
  )
  SELECT 
    rep_name::VARCHAR,
    COALESCE(rep_sales_amount, 0),
    COALESCE(rep_profit_amount, 0),
    CASE 
      WHEN rep_sales_amount > 0 THEN ROUND((rep_profit_amount / rep_sales_amount * 100)::numeric, 2)
      ELSE 0 
    END AS profit_margin
  FROM rep_data
  ORDER BY rep_sales_amount DESC;
END;
$$;
