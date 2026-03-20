-- 00052_company_settings.sql
-- Company settings for tax invoice supplier info

CREATE TABLE company_settings (
  id              SERIAL PRIMARY KEY,
  biz_no          VARCHAR(10) NOT NULL,
  company_name    VARCHAR(100) NOT NULL,
  ceo_name        VARCHAR(50),
  address         VARCHAR(200),
  biz_type        VARCHAR(50),
  biz_item        VARCHAR(50),
  email           VARCHAR(200),
  auto_issue_on_delivery  BOOLEAN DEFAULT false,
  default_tax_type        tax_invoice_tax_type DEFAULT 'tax',
  monthly_consolidation   BOOLEAN DEFAULT false,
  consolidation_day       INT DEFAULT 25,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select" ON company_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role_all" ON company_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO company_settings (biz_no, company_name) VALUES ('', '');
