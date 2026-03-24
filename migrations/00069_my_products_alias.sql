-- Add alias (별칭) column to my_drugs and my_devices
-- Alias is searchable and displayed as the first column in manage mode

ALTER TABLE my_drugs ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE my_devices ADD COLUMN IF NOT EXISTS alias TEXT;
