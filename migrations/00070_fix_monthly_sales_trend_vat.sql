-- Fix get_monthly_sales_trend RPC to calculate from order_items (VAT-inclusive)
-- Previously used orders.supply_amount which was NULL for all orders

CREATE OR REPLACE FUNCTION get_monthly_sales_trend(months_limit INTEGER DEFAULT 6)
RETURNS TABLE(
  month TEXT,
  order_count BIGINT,
  supply_amount NUMERIC,
  profit_amount NUMERIC,
  profit_margin NUMERIC,
  unissued_tax_invoices BIGINT,
  delivered_amount NUMERIC,
  invoiced_amount NUMERIC,
  uninvoiced_amount NUMERIC
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      to_char(DATE_TRUNC('month', o.order_date), 'YYYY-MM') AS month_str,
      COUNT(DISTINCT o.id) AS m_order_count,
      SUM(oi.quantity * ROUND(COALESCE(oi.unit_price, 0) * 1.1)) AS total_revenue_vat,
      SUM(oi.quantity * ROUND(COALESCE(oi.purchase_price, 0) * 1.1)) AS total_purchase_vat,
      COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered') AS m_unissued_tax_invoices,
      SUM(CASE WHEN o.status IN ('delivered', 'invoiced') THEN oi.quantity * ROUND(COALESCE(oi.unit_price, 0) * 1.1) ELSE 0 END) AS m_delivered_amount,
      SUM(CASE WHEN o.status = 'invoiced' THEN oi.quantity * ROUND(COALESCE(oi.unit_price, 0) * 1.1) ELSE 0 END) AS m_invoiced_amount,
      SUM(CASE WHEN o.status = 'delivered' THEN oi.quantity * ROUND(COALESCE(oi.unit_price, 0) * 1.1) ELSE 0 END) AS m_uninvoiced_amount
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY DATE_TRUNC('month', o.order_date)
  )
  SELECT
    month_str,
    m_order_count,
    COALESCE(total_revenue_vat, 0),
    COALESCE(total_revenue_vat - total_purchase_vat, 0),
    CASE
      WHEN total_revenue_vat > 0 THEN ROUND(((total_revenue_vat - total_purchase_vat) / total_revenue_vat * 100)::numeric, 2)
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
