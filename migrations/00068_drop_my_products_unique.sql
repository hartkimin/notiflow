-- Allow duplicate products in my_drugs and my_devices
-- Products can be modified, so the same bar_code/udidi_cd may need multiple entries

ALTER TABLE my_drugs DROP CONSTRAINT IF EXISTS my_drugs_bar_code_key;
ALTER TABLE my_devices DROP CONSTRAINT IF EXISTS my_devices_udidi_cd_key;
