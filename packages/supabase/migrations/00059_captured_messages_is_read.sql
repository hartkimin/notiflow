-- Add is_read column to captured_messages for mobile sync
ALTER TABLE captured_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
