-- 00046_bidirectional_user_sync.sql
-- Bidirectional sync between auth.users metadata and user_profiles

-- 1. Update INSERT trigger to also read role from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email, 'Unknown'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    role = COALESCE(EXCLUDED.role, user_profiles.role),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Sync auth.users metadata changes → user_profiles
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_name TEXT;
  new_role TEXT;
BEGIN
  -- Only act if raw_user_meta_data actually changed
  IF NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data THEN
    new_name := NEW.raw_user_meta_data ->> 'name';
    new_role := NEW.raw_user_meta_data ->> 'role';

    UPDATE public.user_profiles SET
      name = COALESCE(new_name, name),
      role = COALESCE(new_role, role),
      updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to allow re-run
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_updated();
