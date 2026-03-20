-- 00053_tax_invoices.sql
-- Main tax invoice tables, indexes, RPC, RLS, triggers

-- ═══ 1. tax_invoices table ═══
CREATE TABLE tax_invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(24) NOT NULL UNIQUE,
  invoice_type    tax_invoice_type DEFAULT 'normal',
  tax_type        tax_invoice_tax_type DEFAULT 'tax',

  issue_date       DATE NOT NULL,
  supply_date      DATE,
  supply_date_from DATE,
  supply_date_to   DATE,

  supplier_id         INT REFERENCES suppliers(id),
  supplier_biz_no     VARCHAR(10) NOT NULL,
  supplier_name       VARCHAR(100) NOT NULL,
  supplier_ceo_name   VARCHAR(50),
  supplier_address    VARCHAR(200),
  supplier_biz_type   VARCHAR(50),
  supplier_biz_item   VARCHAR(50),
  supplier_email      VARCHAR(200),

  hospital_id         INT REFERENCES hospitals(id),
  buyer_biz_no        VARCHAR(10) NOT NULL,
  buyer_name          VARCHAR(100) NOT NULL,
  buyer_ceo_name      VARCHAR(50),
  buyer_address       VARCHAR(200),
  buyer_biz_type      VARCHAR(50),
  buyer_biz_item      VARCHAR(50),
  buyer_email         VARCHAR(200),

  supply_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,

  status          tax_invoice_status DEFAULT 'draft',
  remarks         TEXT,
  issued_at       TIMESTAMPTZ,
  issued_by       UUID REFERENCES auth.users(id),
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    UUID REFERENCES auth.users(id),

  original_invoice_id INT REFERENCES tax_invoices(id),
  modify_reason   modify_reason,

  pdf_url         VARCHAR(500),

  nts_confirm_no  VARCHAR(50),
  asp_response    JSONB,
  sent_to_nts_at  TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tax_invoices_status ON tax_invoices(status);
CREATE INDEX idx_tax_invoices_issue_date ON tax_invoices(issue_date);
CREATE INDEX idx_tax_invoices_hospital ON tax_invoices(hospital_id);
CREATE INDEX idx_tax_invoices_number ON tax_invoices(invoice_number);

-- ═══ 2. tax_invoice_items table ═══
CREATE TABLE tax_invoice_items (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  order_id        INT REFERENCES orders(id),
  order_item_id   INT REFERENCES order_items(id),
  item_seq        INT NOT NULL DEFAULT 1,
  item_date       DATE,
  item_name       VARCHAR(200) NOT NULL,
  specification   VARCHAR(100),
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  supply_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  remark          VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tax_invoice_items_invoice ON tax_invoice_items(invoice_id);

-- ═══ 3. tax_invoice_orders mapping table (N:M) ═══
CREATE TABLE tax_invoice_orders (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  order_id        INT NOT NULL REFERENCES orders(id),
  amount          DECIMAL(15,2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, order_id)
);

-- ═══ 4. Invoice number generation RPC ═══
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  today_str VARCHAR(8);
  seq_num INT;
  new_number VARCHAR(24);
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 13) AS INT)
  ), 0) + 1
  INTO seq_num
  FROM tax_invoices
  WHERE invoice_number LIKE 'TI-' || today_str || '-%';

  new_number := 'TI-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ═══ 5. RLS policies ═══
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_select" ON tax_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON tax_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON tax_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete" ON tax_invoices FOR DELETE TO authenticated USING (true);

ALTER TABLE tax_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_select" ON tax_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON tax_invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON tax_invoice_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete" ON tax_invoice_items FOR DELETE TO authenticated USING (true);

ALTER TABLE tax_invoice_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON tax_invoice_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══ 6. updated_at trigger ═══
CREATE TRIGGER set_updated_at_tax_invoices
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
