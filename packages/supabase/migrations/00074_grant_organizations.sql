-- Grant organizations table access to PostgREST roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
