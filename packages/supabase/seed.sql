-- ============================================================
-- NotiFlow Order System - Seed Data
-- AI settings defaults for the settings table
-- ============================================================

INSERT INTO settings (key, value) VALUES
  ('ai_enabled', 'true'),
  ('ai_model', '"claude-haiku-4-5-20251001"'),
  ('ai_parse_prompt', NULL),
  ('ai_auto_process', 'true'),
  ('ai_confidence_threshold', '0.7')
ON CONFLICT (key) DO NOTHING;
