-- ============================================================
-- Migration: 00018_captured_messages_room_name.sql
-- Description: Add room_name and attached_image columns to
--   captured_messages for chat room grouping and image support.
--   Also adds a PostgreSQL function for chat room aggregation
--   and full-text message search used by the web dashboard.
-- ============================================================

-- 1. Add missing columns
ALTER TABLE public.captured_messages
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS attached_image TEXT;

-- Index for chat room grouping (source + room_name/sender)
CREATE INDEX IF NOT EXISTS idx_mob_messages_room
  ON public.captured_messages(source, COALESCE(room_name, sender));

-- 2. RPC: Chat room list with optional full-text search
CREATE OR REPLACE FUNCTION get_chat_rooms(
  p_query TEXT DEFAULT NULL,
  p_source_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  source        TEXT,
  app_name      TEXT,
  room_id       TEXT,
  display_title TEXT,
  last_message  TEXT,
  last_received_at BIGINT,
  unread_count  INT,
  sender_icon   TEXT,
  match_count   INT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH room_base AS (
    -- Latest message per chat room
    SELECT DISTINCT ON (m.source, COALESCE(m.room_name, m.sender))
      m.source,
      m.app_name,
      COALESCE(m.room_name, m.sender) AS room_id,
      COALESCE(m.room_name, m.sender) AS display_title,
      m.content                       AS last_message,
      m.received_at                   AS last_received_at,
      m.sender_icon
    FROM captured_messages m
    WHERE m.user_id = v_user_id
      AND m.is_deleted = false
      AND (p_source_filter IS NULL OR m.source = p_source_filter)
    ORDER BY m.source, COALESCE(m.room_name, m.sender), m.received_at DESC
  ),
  search_matches AS (
    -- Messages matching the search query (only when query is provided)
    SELECT
      m.source,
      COALESCE(m.room_name, m.sender) AS room_id,
      m.content AS matched_content,
      m.received_at AS matched_at,
      ROW_NUMBER() OVER (
        PARTITION BY m.source, COALESCE(m.room_name, m.sender)
        ORDER BY m.received_at DESC
      ) AS rn
    FROM captured_messages m
    WHERE p_query IS NOT NULL
      AND p_query <> ''
      AND m.user_id = v_user_id
      AND m.is_deleted = false
      AND (p_source_filter IS NULL OR m.source = p_source_filter)
      AND (m.content ILIKE '%' || p_query || '%' OR m.sender ILIKE '%' || p_query || '%')
  ),
  search_counts AS (
    SELECT source, room_id, COUNT(*)::INT AS cnt
    FROM search_matches
    GROUP BY source, room_id
  )
  SELECT
    rb.source,
    rb.app_name,
    rb.room_id,
    rb.display_title,
    -- When searching, show the most recent matching message snippet
    COALESCE(sm.matched_content, rb.last_message) AS last_message,
    rb.last_received_at,
    0 AS unread_count,
    rb.sender_icon,
    COALESCE(sc.cnt, 0) AS match_count
  FROM room_base rb
  LEFT JOIN search_matches sm
    ON sm.source = rb.source AND sm.room_id = rb.room_id AND sm.rn = 1
  LEFT JOIN search_counts sc
    ON sc.source = rb.source AND sc.room_id = rb.room_id
  WHERE
    -- If searching, only show rooms that match by name or have matching messages
    p_query IS NULL
    OR p_query = ''
    OR sc.cnt > 0
    OR rb.display_title ILIKE '%' || p_query || '%'
    OR rb.app_name ILIKE '%' || p_query || '%'
  ORDER BY rb.last_received_at DESC;
END;
$$;

-- 3. RPC: Search messages within a specific chat room
CREATE OR REPLACE FUNCTION search_chat_messages(
  p_source TEXT,
  p_room_id TEXT,
  p_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  id          TEXT,
  sender      TEXT,
  content     TEXT,
  received_at BIGINT,
  app_name    TEXT,
  sender_icon TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender,
    m.content,
    m.received_at,
    m.app_name,
    m.sender_icon
  FROM captured_messages m
  WHERE m.user_id = v_user_id
    AND m.is_deleted = false
    AND m.source = p_source
    AND COALESCE(m.room_name, m.sender) = p_room_id
    AND (p_query IS NULL OR p_query = ''
         OR m.content ILIKE '%' || p_query || '%'
         OR m.sender ILIKE '%' || p_query || '%')
  ORDER BY m.received_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
