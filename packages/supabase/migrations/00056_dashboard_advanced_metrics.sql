-- 00049_dashboard_advanced_metrics.sql
-- 1. 월별 매출/이익/건수/세금계산서 추이 함수 업데이트 (최근 6개월)
DROP FUNCTION IF EXISTS get_monthly_sales_trend(INT);
CREATE OR REPLACE FUNCTION get_monthly_sales_trend(months_limit INT DEFAULT 6)
RETURNS TABLE (
  month TEXT,
  order_count BIGINT,
  supply_amount DECIMAL(15,2),
  profit_amount DECIMAL(15,2),
  profit_margin DECIMAL(5,2),
  unissued_tax_invoices BIGINT,
  delivered_amount DECIMAL(15,2),
  invoiced_amount DECIMAL(15,2),
  uninvoiced_amount DECIMAL(15,2)
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
      
      -- Tax invoice unissued count (delivered but not invoiced)
      COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered') AS m_unissued_tax_invoices,
      
      -- New metrics
      SUM(CASE WHEN o.status IN ('delivered', 'invoiced') THEN o.supply_amount ELSE 0 END) AS m_delivered_amount,
      SUM(CASE WHEN o.status = 'invoiced' THEN o.supply_amount ELSE 0 END) AS m_invoiced_amount,
      SUM(CASE WHEN o.status = 'delivered' THEN o.supply_amount ELSE 0 END) AS m_uninvoiced_amount

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
    m_unissued_tax_invoices,
    COALESCE(m_delivered_amount, 0),
    COALESCE(m_invoiced_amount, 0),
    COALESCE(m_uninvoiced_amount, 0)
  FROM monthly_data
  ORDER BY month_str DESC
  LIMIT months_limit;
END;
$$;
