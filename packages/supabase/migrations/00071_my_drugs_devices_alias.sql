-- Add alias column to my_drugs and my_devices
-- (was added directly to local DB without a migration)

ALTER TABLE public.my_drugs
  ADD COLUMN IF NOT EXISTS alias text;

ALTER TABLE public.my_devices
  ADD COLUMN IF NOT EXISTS alias text;
