# Design: 수신메시지에서 주문 생성

## Summary

메시지 상세 패널에서 "주문 생성" 버튼을 누르면 /orders 페이지로 이동하여,
메시지 내용이 notes에 pre-fill된 주문 생성 폼이 자동으로 열리는 기능.

## Decisions

| 항목 | 결정 |
|------|------|
| 생성 방식 | 수동 (버튼 → 주문 폼) |
| 버튼 위치 | 메시지 상세 패널 하단 액션 바 |
| UI 형태 | /orders 페이지로 이동 + pre-fill |
| 전달 데이터 | 메시지 content → notes 필드 |
| 전달 방법 | URL query param + SSR fetch |
| 연결 | orders.source_message_id (FK to captured_messages) |

## Data Flow

```
[메시지 상세 패널]  →  "주문 생성" 버튼 클릭
        ↓
  router.push("/orders?create_from_message=<message_id>")
        ↓
[/orders page.tsx]  →  searchParams에서 message_id 감지
        ↓
  서버에서 captured_messages.id로 메시지 fetch
        ↓
  OrderInlineForm에 초기값 전달:
    - notes: 메시지 content
    - isOpen: true (자동 열림)
    - sourceMessageId: 메시지 ID
        ↓
  사용자가 병원/품목/수량 직접 입력 후 저장
        ↓
  createOrderAction에 source_message_id 포함하여 orders INSERT
```

## DB Migration (00033)

```sql
ALTER TABLE orders
  ADD COLUMN source_message_id TEXT
  REFERENCES captured_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_source_message_id ON orders(source_message_id);
```

- TEXT (captured_messages.id가 TEXT 타입)
- ON DELETE SET NULL — 메시지 삭제 시 주문 유지
- nullable — 기존 주문 영향 없음

## Files to Modify

| File | Change |
|------|--------|
| `packages/supabase/migrations/00033_order_source_message.sql` | 새 컬럼 추가 |
| `apps/web/src/lib/queries/messages.ts` | `getMessageById()` 추가 |
| `apps/web/src/lib/types.ts` | Order에 `source_message_id` 추가 |
| `apps/web/src/components/message-inbox/detail-panel.tsx` | 주문 생성 버튼 추가 |
| `apps/web/src/app/(dashboard)/orders/page.tsx` | query param 처리, 메시지 fetch |
| `apps/web/src/components/order-inline-form.tsx` | initialNotes/sourceMessageId props |
| `apps/web/src/app/(dashboard)/orders/actions.ts` | source_message_id 파라미터 추가 |

## Component Details

### detail-panel.tsx
하단 액션 바(핀/복사/삭제 옆)에 ShoppingCart 아이콘 버튼 추가.
클릭 시 `/orders?create_from_message=${msg.id}`로 이동.

### orders/page.tsx
`create_from_message` searchParam 감지 → `getMessageById()` 호출 →
OrderInlineForm에 `initialNotes`, `sourceMessageId` props 전달.

### order-inline-form.tsx
새 props: `initialNotes?: string`, `sourceMessageId?: string`.
initialNotes가 있으면 isOpen=true로 시작, notes에 pre-fill.
createOrderAction 호출 시 source_message_id 포함.

### createOrderAction
insert에 `source_message_id: data.source_message_id ?? null` 추가.
