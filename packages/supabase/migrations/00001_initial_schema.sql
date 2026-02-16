-- ============================================================
-- NotiFlow Order System - Supabase Migration v1
-- Converted from Docker PostgreSQL schema (init-db.sql)
-- Changes: TIMESTAMP -> TIMESTAMPTZ, dashboard_users removed,
--          settings + user_profiles tables added
-- ============================================================

-- ============================================================
-- ENUM types
-- ============================================================

CREATE TYPE hospital_type_enum AS ENUM (
  'hospital', 'clinic', 'pharmacy', 'distributor', 'research', 'other'
);

CREATE TYPE product_category_enum AS ENUM (
  'dialyzer', 'blood_line', 'avf_needle', 'dialysis_solution',
  'filter', 'catheter', 'medication', 'consumable',
  'equipment', 'supplement', 'other'
);

CREATE TYPE parse_status_enum AS ENUM (
  'pending', 'parsed', 'failed', 'skipped'
);

CREATE TYPE order_status_enum AS ENUM (
  'draft', 'confirmed', 'processing', 'delivered', 'cancelled'
);

CREATE TYPE match_status_enum AS ENUM (
  'matched', 'review', 'unmatched', 'manual'
);

CREATE TYPE report_status_enum AS ENUM (
  'pending', 'reported', 'confirmed'
);

CREATE TYPE notification_status_enum AS ENUM (
  'pending', 'sent', 'failed'
);

-- ============================================================
-- 1. hospitals
-- ============================================================
CREATE TABLE hospitals (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  short_name        VARCHAR(100),
  hospital_type     hospital_type_enum NOT NULL DEFAULT 'clinic',
  phone             VARCHAR(20),
  contact_phones    JSON,
  kakao_sender_names JSON DEFAULT '[]',
  address           TEXT,
  contact_person    VARCHAR(100),
  business_number   VARCHAR(20),
  payment_terms     VARCHAR(100),
  trade_start_date  DATE,
  delivery_notes    TEXT,
  lead_time_days    INT DEFAULT 1,
  order_pattern     JSON,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. products
-- ============================================================
CREATE TABLE products (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  official_name     VARCHAR(500),
  short_name        VARCHAR(255),
  category          product_category_enum NOT NULL DEFAULT 'other',
  manufacturer      VARCHAR(255),
  ingredient        VARCHAR(500),
  efficacy          TEXT,
  standard_code     VARCHAR(100),
  unit              VARCHAR(50) DEFAULT '개',
  unit_price        DECIMAL(12,2),
  description       TEXT,
  auto_info         JSON,
  min_order_qty     INT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. product_aliases
-- ============================================================
CREATE TABLE product_aliases (
  id                SERIAL PRIMARY KEY,
  product_id        INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  hospital_id       INT REFERENCES hospitals(id) ON DELETE SET NULL,
  alias             VARCHAR(255) NOT NULL,
  alias_normalized  VARCHAR(255),
  source            VARCHAR(50) DEFAULT 'manual',
  match_count       INT DEFAULT 0,
  last_matched_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. product_box_specs
-- ============================================================
CREATE TABLE product_box_specs (
  id                SERIAL PRIMARY KEY,
  product_id        INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  box_name          VARCHAR(100) DEFAULT '기본',
  qty_per_box       INT NOT NULL,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. suppliers
-- ============================================================
CREATE TABLE suppliers (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  short_name        VARCHAR(100),
  contact_info      JSON,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. product_suppliers
-- ============================================================
CREATE TABLE product_suppliers (
  id                SERIAL PRIMARY KEY,
  product_id        INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id       INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_price    DECIMAL(12,2),
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

-- ============================================================
-- 7. raw_messages
-- ============================================================
CREATE TABLE raw_messages (
  id                SERIAL PRIMARY KEY,
  source_app        VARCHAR(50) NOT NULL,
  sender            VARCHAR(255),
  content           TEXT NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL,
  device_id         VARCHAR(100),
  hospital_id       INT REFERENCES hospitals(id) ON DELETE SET NULL,
  parse_status      parse_status_enum NOT NULL DEFAULT 'pending',
  parse_method      VARCHAR(20),
  parse_result      JSON,
  order_id          INT,
  is_order_message  BOOLEAN,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. orders
-- ============================================================
CREATE TABLE orders (
  id                SERIAL PRIMARY KEY,
  order_number      VARCHAR(30) NOT NULL,
  order_date        DATE NOT NULL,
  hospital_id       INT NOT NULL REFERENCES hospitals(id),
  message_id        INT REFERENCES raw_messages(id) ON DELETE SET NULL,
  status            order_status_enum NOT NULL DEFAULT 'draft',
  total_items       INT DEFAULT 0,
  total_amount      DECIMAL(15,2),
  supply_amount     DECIMAL(15,2),
  tax_amount        DECIMAL(15,2),
  delivery_date     DATE,
  delivered_at      TIMESTAMPTZ,
  pdf_url           VARCHAR(500),
  notes             TEXT,
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from raw_messages.order_id to orders.id (deferred due to circular ref)
ALTER TABLE raw_messages
  ADD CONSTRAINT fk_raw_messages_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ============================================================
-- 9. order_items
-- ============================================================
CREATE TABLE order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INT REFERENCES products(id) ON DELETE SET NULL,
  supplier_id       INT REFERENCES suppliers(id) ON DELETE SET NULL,
  box_spec_id       INT REFERENCES product_box_specs(id) ON DELETE SET NULL,
  original_text     VARCHAR(500),
  quantity          INT NOT NULL,
  unit_type         VARCHAR(20) NOT NULL DEFAULT 'piece',
  calculated_pieces INT,
  unit_price        DECIMAL(12,2),
  purchase_price    DECIMAL(12,2),
  line_total        DECIMAL(12,2),
  match_status      match_status_enum NOT NULL DEFAULT 'matched',
  match_confidence  FLOAT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. parse_history
-- ============================================================
CREATE TABLE parse_history (
  id                  SERIAL PRIMARY KEY,
  message_id          INT NOT NULL REFERENCES raw_messages(id) ON DELETE CASCADE,
  parse_method        VARCHAR(20) NOT NULL,
  llm_model           VARCHAR(100),
  llm_prompt_version  VARCHAR(20),
  input_text          TEXT NOT NULL,
  raw_output          JSON,
  parsed_items        JSON NOT NULL,
  latency_ms          INT,
  token_usage         JSON,
  is_correct          BOOLEAN,
  correction          JSON,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. notification_logs
-- ============================================================
CREATE TABLE notification_logs (
  id                SERIAL PRIMARY KEY,
  event_type        VARCHAR(50) NOT NULL,
  related_id        INT,
  channel           VARCHAR(20) NOT NULL DEFAULT 'telegram',
  recipient         VARCHAR(255),
  message           TEXT NOT NULL,
  status            notification_status_enum NOT NULL DEFAULT 'pending',
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. kpis_reports
-- ============================================================
CREATE TABLE kpis_reports (
  id                SERIAL PRIMARY KEY,
  order_item_id     INT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  report_status     report_status_enum NOT NULL DEFAULT 'pending',
  reported_at       TIMESTAMPTZ,
  reference_number  VARCHAR(100),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. sales_reports
-- ============================================================
CREATE TABLE sales_reports (
  id                SERIAL PRIMARY KEY,
  report_period     VARCHAR(20) NOT NULL,
  order_id          INT REFERENCES orders(id) ON DELETE SET NULL,
  supplier_name     VARCHAR(255),
  hospital_name     VARCHAR(255),
  product_name      VARCHAR(500),
  quantity          INT,
  quantity_unit     VARCHAR(20) DEFAULT 'box',
  standard_code     VARCHAR(100),
  hospital_address  TEXT,
  business_number   VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. settings (AI/system configuration key-value store)
-- ============================================================
CREATE TABLE settings (
  key               VARCHAR(100) PRIMARY KEY,
  value             JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 15. user_profiles (linked to Supabase auth.users)
-- ============================================================
CREATE TABLE user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  role              VARCHAR(20) NOT NULL DEFAULT 'viewer',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- hospitals
CREATE INDEX idx_hospitals_name ON hospitals(name);
CREATE INDEX idx_hospitals_type ON hospitals(hospital_type);
CREATE INDEX idx_hospitals_active ON hospitals(is_active);

-- products
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_active ON products(is_active);

-- product_aliases
CREATE UNIQUE INDEX idx_product_aliases_hospital_alias
  ON product_aliases(hospital_id, alias_normalized)
  WHERE alias_normalized IS NOT NULL;
CREATE INDEX idx_product_aliases_product ON product_aliases(product_id);
CREATE INDEX idx_product_aliases_hospital ON product_aliases(hospital_id);

-- product_box_specs
CREATE INDEX idx_product_box_specs_product ON product_box_specs(product_id);

-- product_suppliers
CREATE INDEX idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier ON product_suppliers(supplier_id);

-- raw_messages
CREATE INDEX idx_raw_messages_parse_status ON raw_messages(parse_status);
CREATE INDEX idx_raw_messages_hospital ON raw_messages(hospital_id);
CREATE INDEX idx_raw_messages_received_at ON raw_messages(received_at);

-- orders
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_hospital ON orders(hospital_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date_hospital ON orders(order_date, hospital_id);

-- order_items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_match_status ON order_items(match_status);

-- parse_history
CREATE INDEX idx_parse_history_message ON parse_history(message_id);

-- notification_logs
CREATE INDEX idx_notification_logs_event ON notification_logs(event_type);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);

-- kpis_reports
CREATE INDEX idx_kpis_reports_status ON kpis_reports(report_status);
CREATE INDEX idx_kpis_reports_order_item ON kpis_reports(order_item_id);

-- sales_reports
CREATE INDEX idx_sales_reports_period ON sales_reports(report_period);
CREATE INDEX idx_sales_reports_order ON sales_reports(order_id);

-- user_profiles
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active);

-- settings
CREATE INDEX idx_settings_key ON settings(key);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
