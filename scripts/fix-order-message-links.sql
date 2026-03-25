-- ============================================================
-- 기존 주문의 source_message_id 연결 상태 점검 및 수정
-- Supabase Studio SQL Editor에서 실행
-- ============================================================

-- 1. 진단: source_message_id가 있는 주문 수 vs 없는 주문 수
SELECT
  COUNT(*) AS total_orders,
  COUNT(source_message_id) AS with_source_message,
  COUNT(*) - COUNT(source_message_id) AS without_source_message
FROM orders;

-- 2. 진단: source_message_id가 설정된 주문 중 실제 captured_messages에 존재하는 메시지 매칭 확인
SELECT
  o.id AS order_id,
  o.order_number,
  o.source_message_id,
  CASE WHEN cm.id IS NOT NULL THEN 'OK' ELSE 'BROKEN (message not found)' END AS link_status
FROM orders o
LEFT JOIN captured_messages cm ON cm.id = o.source_message_id
WHERE o.source_message_id IS NOT NULL
ORDER BY o.created_at DESC;

-- 3. 진단: source_message_id가 없는 주문 목록 (수동 연결이 필요할 수 있는 건)
SELECT
  o.id AS order_id,
  o.order_number,
  o.order_date,
  o.notes,
  h.name AS hospital_name,
  o.created_at
FROM orders o
LEFT JOIN hospitals h ON h.id = o.hospital_id
WHERE o.source_message_id IS NULL
ORDER BY o.created_at DESC;

-- 4. 수정: notes에 AI 자동 생성 표시가 있지만 source_message_id가 없는 주문을
--    시간/병원 기준으로 captured_messages와 매칭 시도
--    ⚠️ 아래 UPDATE는 dry-run입니다. 먼저 SELECT로 결과를 확인하세요.

-- 4a. 매칭 후보 확인 (SELECT로 먼저 확인)
SELECT
  o.id AS order_id,
  o.order_number,
  o.order_date,
  o.created_at AS order_created,
  cm.id AS candidate_message_id,
  cm.sender,
  LEFT(cm.content, 80) AS message_preview,
  to_timestamp(cm.received_at / 1000) AS message_received
FROM orders o
CROSS JOIN LATERAL (
  SELECT cm2.*
  FROM captured_messages cm2
  WHERE cm2.received_at >= EXTRACT(EPOCH FROM (o.created_at - INTERVAL '1 hour')) * 1000
    AND cm2.received_at <= EXTRACT(EPOCH FROM o.created_at) * 1000
    AND cm2.is_deleted = false
  ORDER BY cm2.received_at DESC
  LIMIT 1
) cm
WHERE o.source_message_id IS NULL
ORDER BY o.created_at DESC;

-- 4b. 실제 UPDATE (위 SELECT 결과를 확인한 후에만 실행하세요)
-- UPDATE orders o
-- SET source_message_id = sub.candidate_message_id
-- FROM (
--   SELECT DISTINCT ON (o2.id)
--     o2.id AS order_id,
--     cm.id AS candidate_message_id
--   FROM orders o2
--   CROSS JOIN LATERAL (
--     SELECT cm2.*
--     FROM captured_messages cm2
--     WHERE cm2.received_at >= EXTRACT(EPOCH FROM (o2.created_at - INTERVAL '1 hour')) * 1000
--       AND cm2.received_at <= EXTRACT(EPOCH FROM o2.created_at) * 1000
--       AND cm2.is_deleted = false
--     ORDER BY cm2.received_at DESC
--     LIMIT 1
--   ) cm
--   WHERE o2.source_message_id IS NULL
-- ) sub
-- WHERE o.id = sub.order_id;
