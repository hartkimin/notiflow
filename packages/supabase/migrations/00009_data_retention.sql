-- 00009_data_retention.sql
-- Data retention policy: archive raw_messages older than 90 days
-- and clean up old notification_logs and audit_logs

-- ─── Archived Messages Table ────────────────────────────────────
-- Mirrors raw_messages schema for compliance/historical queries
CREATE TABLE IF NOT EXISTS public.archived_messages (
  id integer PRIMARY KEY,
  source_app varchar(50),
  sender varchar(255),
  content text,
  received_at timestamptz,
  device_id varchar(100),
  hospital_id int,
  parse_status text,
  parse_method varchar(20),
  parse_result json,
  order_id int,
  is_order_message boolean,
  synced_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_archived_messages_received_at ON archived_messages(received_at);
CREATE INDEX idx_archived_messages_sender ON archived_messages(sender);

ALTER TABLE public.archived_messages ENABLE ROW LEVEL SECURITY;

-- Admin can query archived data
CREATE POLICY "Admin can view archived messages"
  ON public.archived_messages FOR SELECT
  USING ((SELECT public.get_user_role()) = 'admin');

-- ─── Archive Function ───────────────────────────────────────────
-- Moves raw_messages older than retention_days to archived_messages
-- Returns the number of archived rows
CREATE OR REPLACE FUNCTION archive_old_messages(retention_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date timestamptz;
  archived_count int;
BEGIN
  cutoff_date := now() - (retention_days || ' days')::interval;

  -- Insert into archive (ignore duplicates)
  INSERT INTO archived_messages (
    id, source_app, sender, content,
    received_at, device_id, hospital_id, parse_status, parse_method,
    parse_result, order_id, is_order_message, synced_at
  )
  SELECT
    id, source_app, sender, content,
    received_at, device_id, hospital_id, parse_status::text, parse_method,
    parse_result, order_id, is_order_message, synced_at
  FROM raw_messages
  WHERE received_at < cutoff_date
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  -- Delete archived rows from active table
  DELETE FROM raw_messages
  WHERE received_at < cutoff_date
    AND id IN (SELECT id FROM archived_messages);

  RETURN archived_count;
END;
$$;

-- ─── Cleanup Function ───────────────────────────────────────────
-- Removes old notification_logs (>180 days) and audit_logs (>365 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notif_count int;
  audit_count int;
BEGIN
  DELETE FROM notification_logs
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS notif_count = ROW_COUNT;

  DELETE FROM audit_logs
  WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS audit_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'notification_logs_deleted', notif_count,
    'audit_logs_deleted', audit_count
  );
END;
$$;

-- ─── Missing Index ──────────────────────────────────────────────
-- notification_logs.sent_at is used in cleanup_old_logs DELETE
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
