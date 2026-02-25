-- 00020_forecast_tables.sql
-- Add order forecast tables for pre-entering expected orders and matching with messages

-- Enum for forecast status
DO $$ BEGIN
  CREATE TYPE forecast_status_enum AS ENUM ('pending', 'matched', 'partial', 'missed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order patterns table (recurring order schedules)
CREATE TABLE IF NOT EXISTS order_patterns (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name            VARCHAR(100),
  recurrence      JSONB NOT NULL,
  default_items   JSONB,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  last_generated  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order forecasts table (expected orders per day)
CREATE TABLE IF NOT EXISTS order_forecasts (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  forecast_date   DATE NOT NULL,
  notes           TEXT,
  status          forecast_status_enum NOT NULL DEFAULT 'pending',
  source          VARCHAR(20) DEFAULT 'manual',
  pattern_id      INT REFERENCES order_patterns(id) ON DELETE SET NULL,
  message_id      INT REFERENCES raw_messages(id) ON DELETE SET NULL,
  matched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, forecast_date)
);

-- Forecast items table (expected products)
CREATE TABLE IF NOT EXISTS forecast_items (
  id              SERIAL PRIMARY KEY,
  forecast_id     INT NOT NULL REFERENCES order_forecasts(id) ON DELETE CASCADE,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  product_name    VARCHAR(255),
  quantity        INT,
  unit_type       VARCHAR(20) DEFAULT 'piece',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add forecast_id FK to raw_messages
DO $$ BEGIN
  ALTER TABLE raw_messages ADD COLUMN forecast_id INT REFERENCES order_forecasts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_forecasts_date ON order_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_order_forecasts_hospital ON order_forecasts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_order_forecasts_status ON order_forecasts(status);
CREATE INDEX IF NOT EXISTS idx_forecast_items_forecast ON forecast_items(forecast_id);
CREATE INDEX IF NOT EXISTS idx_order_patterns_hospital ON order_patterns(hospital_id);
CREATE INDEX IF NOT EXISTS idx_raw_messages_forecast ON raw_messages(forecast_id);

-- RLS policies (dashboard users have full access)
ALTER TABLE order_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_forecasts_all" ON order_forecasts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dashboard_forecast_items_all" ON forecast_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dashboard_order_patterns_all" ON order_patterns
  FOR ALL USING (true) WITH CHECK (true);
