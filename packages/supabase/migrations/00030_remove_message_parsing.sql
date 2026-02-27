-- 00030_remove_message_parsing.sql
-- Remove message parsing infrastructure (keep AI connection settings)

-- 1. Drop FK constraint and column from orders
ALTER TABLE orders DROP COLUMN IF EXISTS message_id;

-- 2. Drop parsing columns from order_items
ALTER TABLE order_items DROP COLUMN IF EXISTS original_text;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_confidence;

-- 3. Drop raw_messages table (CASCADE drops dependent objects)
DROP TABLE IF EXISTS raw_messages CASCADE;

-- 4. Drop enum types used by parsing
DROP TYPE IF EXISTS match_status_enum;
DROP TYPE IF EXISTS parse_status_enum;

-- 5. Remove parsing-specific settings (keep AI connection keys)
DELETE FROM settings WHERE key IN (
  'ai_parse_prompt',
  'ai_auto_process',
  'ai_confidence_threshold'
);
