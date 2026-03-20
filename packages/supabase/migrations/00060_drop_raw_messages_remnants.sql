-- Drop leftover triggers and functions that reference the removed raw_messages table.
-- raw_messages was dropped in 00030, but these objects survived.
DROP TRIGGER IF EXISTS bridge_captured_message ON captured_messages;
DROP FUNCTION IF EXISTS bridge_captured_to_raw();
DROP FUNCTION IF EXISTS notify_parse_message();
DROP FUNCTION IF EXISTS archive_old_messages(int);
