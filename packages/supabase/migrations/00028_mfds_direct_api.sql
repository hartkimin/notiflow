-- 00028_mfds_direct_api.sql
-- Transition from full MFDS sync to direct API search

-- 1. Add new columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfds_raw JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfds_source_type TEXT;

-- 2. Remove FK to mfds_items
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_mfds_item_id_fkey;
ALTER TABLE products DROP COLUMN IF EXISTS mfds_item_id;

-- 3. Drop RPC function
DROP FUNCTION IF EXISTS update_products_from_mfds(TIMESTAMPTZ);

-- 4. Drop mfds_sync_logs
DROP TABLE IF EXISTS mfds_sync_logs CASCADE;

-- 5. Drop mfds_items (and all indexes, triggers)
DROP TABLE IF EXISTS mfds_items CASCADE;

-- 6. Drop enum type (if no longer referenced)
DROP TYPE IF EXISTS mfds_source_type CASCADE;
