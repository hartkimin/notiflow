-- ============================================================
-- Migration: 00010_mobile_sync_tables.sql
-- Description: Tables for mobile app (Android) Supabase sync.
--   The mobile app stores data locally in Room and syncs
--   bidirectionally with these Supabase tables via PostgREST
--   and Realtime subscriptions.
--   All timestamps are epoch milliseconds (BIGINT), matching
--   the Kotlin Long type used in Room entities.
--   Each row is scoped to a user via user_id (auth.users FK).
-- ============================================================

-- 1. categories
CREATE TABLE IF NOT EXISTS public.categories (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       INTEGER NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_deleted  BOOLEAN NOT NULL DEFAULT false,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX idx_mob_categories_user ON public.categories(user_id);

-- 2. status_steps
CREATE TABLE IF NOT EXISTS public.status_steps (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  color       INTEGER NOT NULL,
  is_deleted  BOOLEAN NOT NULL DEFAULT false,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX idx_mob_status_steps_user ON public.status_steps(user_id);

-- 3. filter_rules
CREATE TABLE IF NOT EXISTS public.filter_rules (
  id                  TEXT PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id         TEXT NOT NULL,
  sender_keywords     TEXT[] NOT NULL DEFAULT '{}',
  sender_match_type   TEXT NOT NULL DEFAULT 'CONTAINS',
  sms_phone_number    TEXT,
  include_words       TEXT[] NOT NULL DEFAULT '{}',
  exclude_words       TEXT[] NOT NULL DEFAULT '{}',
  include_match_type  TEXT NOT NULL DEFAULT 'OR',
  condition_type      TEXT NOT NULL DEFAULT 'AND',
  target_app_packages TEXT[] NOT NULL DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  created_at          BIGINT NOT NULL,
  updated_at          BIGINT NOT NULL
);

CREATE INDEX idx_mob_filter_rules_user ON public.filter_rules(user_id);
CREATE INDEX idx_mob_filter_rules_category ON public.filter_rules(category_id);

-- 4. captured_messages
CREATE TABLE IF NOT EXISTS public.captured_messages (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id       TEXT,
  matched_rule_id   TEXT,
  source            TEXT NOT NULL,
  app_name          TEXT NOT NULL,
  sender            TEXT NOT NULL,
  content           TEXT NOT NULL,
  status_id         TEXT,
  comment           TEXT,
  sender_icon       TEXT,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  is_deleted        BOOLEAN NOT NULL DEFAULT false,
  received_at       BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL,
  status_changed_at BIGINT,
  status_history    TEXT,
  is_pinned         BOOLEAN NOT NULL DEFAULT false,
  snooze_at         BIGINT,
  original_content  TEXT
);

CREATE INDEX idx_mob_messages_user ON public.captured_messages(user_id);
CREATE INDEX idx_mob_messages_category ON public.captured_messages(category_id);
CREATE INDEX idx_mob_messages_status ON public.captured_messages(status_id);
CREATE INDEX idx_mob_messages_received ON public.captured_messages(received_at);

-- 5. app_filters
CREATE TABLE IF NOT EXISTS public.app_filters (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  app_name     TEXT NOT NULL,
  is_allowed   BOOLEAN NOT NULL DEFAULT true,
  is_deleted   BOOLEAN NOT NULL DEFAULT false,
  updated_at   BIGINT NOT NULL
);

CREATE INDEX idx_mob_app_filters_user ON public.app_filters(user_id);

-- 6. plans
CREATE TABLE IF NOT EXISTS public.plans (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id       TEXT,
  date              BIGINT NOT NULL,
  title             TEXT NOT NULL,
  is_completed      BOOLEAN NOT NULL DEFAULT false,
  linked_message_id TEXT,
  order_number      TEXT,
  order_index       INTEGER NOT NULL DEFAULT 0,
  is_deleted        BOOLEAN NOT NULL DEFAULT false,
  created_at        BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL
);

CREATE INDEX idx_mob_plans_user ON public.plans(user_id);
CREATE INDEX idx_mob_plans_date ON public.plans(date);

-- 7. day_categories
CREATE TABLE IF NOT EXISTS public.day_categories (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        BIGINT NOT NULL,
  category_id TEXT NOT NULL,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX idx_mob_day_categories_user ON public.day_categories(user_id);
CREATE INDEX idx_mob_day_categories_date ON public.day_categories(date);

-- ============================================================
-- RLS: each user can only access their own rows
-- ============================================================

ALTER TABLE public.categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_filters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_categories   ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE POLICY "Users manage own categories"
  ON public.categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Status steps
CREATE POLICY "Users manage own status_steps"
  ON public.status_steps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Filter rules
CREATE POLICY "Users manage own filter_rules"
  ON public.filter_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Captured messages
CREATE POLICY "Users manage own captured_messages"
  ON public.captured_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- App filters
CREATE POLICY "Users manage own app_filters"
  ON public.app_filters FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Plans
CREATE POLICY "Users manage own plans"
  ON public.plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Day categories
CREATE POLICY "Users manage own day_categories"
  ON public.day_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Realtime: add mobile tables to publication
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.categories,
  public.status_steps,
  public.filter_rules,
  public.captured_messages,
  public.app_filters,
  public.plans,
  public.day_categories;
