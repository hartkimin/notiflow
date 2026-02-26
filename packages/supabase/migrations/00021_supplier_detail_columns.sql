-- 00021: Add detail columns to suppliers table for AI search enrichment
-- These columns allow AI to auto-fill supplier business information.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_number VARCHAR(20);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ceo_name        VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone           VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS fax             VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website         VARCHAR(500);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_type   VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_category VARCHAR(100);
