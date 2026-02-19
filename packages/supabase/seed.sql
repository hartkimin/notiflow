-- ============================================================
-- NotiFlow Order System - Seed Data
-- Run automatically on `supabase db reset`
-- ============================================================

-- AI settings defaults
INSERT INTO settings (key, value) VALUES
  ('ai_enabled', 'true'),
  ('ai_provider', '"google"'),
  ('ai_model', '"gemini-2.0-flash"'),
  ('ai_parse_prompt', NULL),
  ('ai_auto_process', 'true'),
  ('ai_confidence_threshold', '0.7')
ON CONFLICT (key) DO NOTHING;

-- Test user (for local development only)
-- Email: test@notiflow.local / Password: test1234
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'test@notiflow.local',
  crypt('test1234', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"테스트 관리자"}',
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'test@notiflow.local',
  'email',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"test@notiflow.local"}',
  now(), now(), now()
) ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO user_profiles (id, email, name, role, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'test@notiflow.local', '테스트 관리자', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- Sample hospitals
INSERT INTO hospitals (name, short_name, type, contact_name, contact_phone) VALUES
  ('서울대학교병원', '서울대병원', 'hospital', '김약사', '02-2072-0000'),
  ('연세의료원 세브란스', '세브란스', 'hospital', '이약사', '02-2228-0000'),
  ('분당서울대병원', '분당서울대', 'hospital', '박약사', '031-787-0000')
ON CONFLICT DO NOTHING;

-- Sample products
INSERT INTO products (name, official_name, short_name, category, unit, is_active) VALUES
  ('혈액투석여과기 EK-15H', '혈액투석여과기 EK-15H', 'EK15', 'dialyzer', 'piece', true),
  ('AVF NEEDLE 16G', 'AVF NEEDLE 16G', '니들16G', 'avf_needle', 'piece', true),
  ('헤모시스비액 12.6L', '헤모시스비액 12.6L', NULL, 'dialysis_solution', 'piece', true),
  ('헤모시스에이지액 10L', '헤모시스에이지액 10L', NULL, 'dialysis_solution', 'piece', true),
  ('혈액투석여과기 APS-15SA', '혈액투석여과기 APS-15SA', 'APS15', 'dialyzer', 'piece', true),
  ('세프트리악손나트륨 2g', '세프트리악손나트륨 2g', '세프트리악손', 'medication', 'piece', true)
ON CONFLICT DO NOTHING;

-- Sample aliases (hospital-specific)
INSERT INTO product_aliases (alias, alias_normalized, product_id, hospital_id)
SELECT 'EK15', 'ek15', p.id, h.id
FROM products p, hospitals h
WHERE p.official_name = '혈액투석여과기 EK-15H' AND h.short_name = '서울대병원'
ON CONFLICT DO NOTHING;

INSERT INTO product_aliases (alias, alias_normalized, product_id, hospital_id)
SELECT '니들', '니들', p.id, h.id
FROM products p, hospitals h
WHERE p.official_name = 'AVF NEEDLE 16G' AND h.short_name = '서울대병원'
ON CONFLICT DO NOTHING;

INSERT INTO product_aliases (alias, alias_normalized, product_id, hospital_id)
SELECT 'b', 'b', p.id, h.id
FROM products p, hospitals h
WHERE p.official_name = '헤모시스비액 12.6L' AND h.short_name = '서울대병원'
ON CONFLICT DO NOTHING;

INSERT INTO product_aliases (alias, alias_normalized, product_id, hospital_id)
SELECT 'G', 'g', p.id, h.id
FROM products p, hospitals h
WHERE p.official_name = '헤모시스에이지액 10L' AND h.short_name = '서울대병원'
ON CONFLICT DO NOTHING;
