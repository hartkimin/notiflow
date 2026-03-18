-- 00037_initial_data.sql
-- Seed initial data into the system after all migrations are completed

-- 1. AI settings defaults
INSERT INTO settings (key, value) VALUES
  ('ai_enabled', 'true'),
  ('ai_provider', '"google"'),
  ('ai_model', '"gemini-2.0-flash"'),
  ('ai_auto_process', 'true'),
  ('ai_confidence_threshold', '0.7')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Test user (Email: test@notiflow.local / Password: test1234)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, phone, phone_change, phone_change_token,
  email_change_token_current, reauthentication_token, is_sso_user, is_anonymous
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'test@notiflow.local',
  crypt('test1234', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"테스트 관리자"}',
  'authenticated', 'authenticated',
  '', '', '',
  '', '', '', '',
  '', '', false, false
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
) ON CONFLICT (provider_id, provider) DO NOTHING;

INSERT INTO user_profiles (id, name, role, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', '테스트 관리자', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Sample hospitals
INSERT INTO hospitals (name, short_name, hospital_type, contact_person, phone) VALUES
  ('서울대학교병원', '서울대병원', 'hospital', '김약사', '02-2072-0000'),
  ('연세의료원 세브란스', '세브란스', 'hospital', '이약사', '02-2228-0000'),
  ('분당서울대병원', '분당서울대', 'hospital', '박약사', '031-787-0000')
ON CONFLICT DO NOTHING;

-- 4. Sample legacy products
INSERT INTO products (name, official_name, short_name, category, unit, is_active) VALUES
  ('혈액투석여과기 EK-15H', '혈액투석여과기 EK-15H', 'EK15', 'dialyzer', '개', true),
  ('AVF NEEDLE 16G', 'AVF NEEDLE 16G', '니들16G', 'avf_needle', '개', true)
ON CONFLICT DO NOTHING;
