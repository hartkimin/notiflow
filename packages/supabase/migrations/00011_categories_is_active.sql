-- Add is_active column to categories table
-- Mobile Room entity has isActive:Boolean=true but it was missing from Supabase schema
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
