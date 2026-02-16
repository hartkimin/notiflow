# Phase 1: 안정화 — 설계 문서

> **작성일:** 2026-02-16
> **Phase:** 1 (안정화)
> **목표:** 현재 구현된 기능의 프로덕션 안정성 확보

---

## 1. 범위

| # | 영역 | 과제 | 산출물 |
|---|------|------|--------|
| 1.1 | Supabase | DB Webhook 마이그레이션 SQL | `00004_webhooks.sql` |
| 1.2 | Supabase | Edge Function 배포 자동화 | 배포 스크립트 |
| 1.3 | Vercel | 환경변수 설정 확인 | 설정 가이드 |
| 1.4 | Web | 에러 핸들링 통합 | 3개 컴포넌트 수정 |
| 1.5 | Mobile | FCM 토큰 등록 코드 | Kotlin + SQL |
| 1.6 | 전체 | E2E 연동 테스트 시나리오 | 테스트 문서 |

---

## 2. 설계 상세

### 2.1 DB Webhook (pg_net 트리거)

**방식:** PostgreSQL trigger + `pg_net` extension으로 Edge Function HTTP 호출

```sql
-- raw_messages INSERT → parse-message
CREATE TRIGGER on_raw_message_inserted
  AFTER INSERT ON raw_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_parse_message();

-- orders INSERT → send-push
CREATE TRIGGER on_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_send_push();
```

**함수 구현:** `net.http_post()`로 Edge Function URL + service_role_key 호출

### 2.2 에러 핸들링 통합

**대상 컴포넌트:**
- `product-list.tsx` — 4개 핸들러 (delete, create, update, alias CRUD)
- `hospital-list.tsx` — 2개 핸들러 (delete, create/update)
- `supplier-list.tsx` — 2개 핸들러 (delete, create/update)

**패턴:** 기존 `delivery-list.tsx`의 패턴 적용
```tsx
try {
  await serverAction();
  toast.success("성공 메시지");
} catch (e) {
  toast.error(e instanceof Error ? e.message : "오류 발생");
}
```

### 2.3 FCM 토큰 등록

**Supabase:**
- `device_tokens` 테이블 (user_id, fcm_token, device_name, platform, updated_at)
- RLS: 인증된 사용자가 자신의 토큰만 관리

**Android:**
- Firebase BOM + firebase-messaging-ktx 의존성
- `NotiFlowFcmService` (FirebaseMessagingService)
- `onNewToken()` → Supabase device_tokens upsert
- `onMessageReceived()` → 로컬 알림 표시

### 2.4 Edge Function 배포

**방식:** Supabase CLI 기반 스크립트
```bash
supabase functions deploy parse-message
supabase functions deploy send-push
supabase functions deploy manage-users
supabase functions deploy test-parse
supabase db push  # 마이그레이션 적용
```

### 2.5 Vercel 환경변수

**필수 변수 확인:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.6 E2E 테스트

**핵심 흐름 시나리오:**
1. 메시지 수신 → Supabase INSERT → Webhook → AI 파싱 → 주문 생성
2. 주문 생성 → FCM 알림 → 앱 수신
3. 대시보드 실시간 반영 확인
