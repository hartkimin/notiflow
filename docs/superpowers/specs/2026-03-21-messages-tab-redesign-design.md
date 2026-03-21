# 수신메시지 탭 개선 설계

**날짜:** 2026-03-21
**상태:** Draft

## 개요

수신메시지 탭을 3패널 레이아웃에서 테이블+아코디언 방식으로 전환하고, AI 파싱 기능을 전면 제거하며, 다중 선택 주문 생성 워크플로우를 개선한다.

## 변경 범위

### 1. 테이블 뷰 (목록 탭)

기존 3패널(목록/상세/주문) 레이아웃을 단일 테이블로 교체한다.

**테이블 컬럼 (순서대로):**

| # | 컬럼 | 필드 | 설명 |
|---|------|------|------|
| 1 | 체크박스 | — | 다중 선택 |
| 2 | 수신시간 | `received_at` | `MM/DD HH:mm` 형식 |
| 3 | 출처 | `app_name` | 카카오톡/SMS/텔레그램 뱃지 |
| 4 | 발신자 | `sender` | |
| 5 | 채팅방 | `room_name` | 없으면 `-` |
| 6 | 내용 미리보기 | `content` | 1줄 truncate |
| 7 | 상태 | `status_id` | 컬러 도트 + 라벨 |

**아코디언 상세 (행 클릭 시 펼침):**

아코디언은 2컬럼 레이아웃으로 구성:
- **왼쪽:** 전체 메시지 내용 (`content` 전문) + 메타 정보 (기기명, 카테고리, 수신시간 상세)
- **오른쪽:** 코멘트 목록/추가, 액션 버튼 (편집, 복사, 핀 고정, 삭제)

선택된 행(체크박스)은 파란색 배경으로 시각 구분한다.

### 2. 다중 선택 주문 생성

하단에 플로팅 액션바가 표시되며 다음 버튼을 포함:
- **주문 생성** — `orders/new` 페이지로 이동, 선택된 메시지 ID들을 query parameter로 전달
- **삭제** — 선택된 메시지 일괄 삭제 (확인 다이얼로그)
- **선택 해제** — 전체 선택 해제

**주문 생성 시 메모 포맷:**

선택된 모든 메시지의 내용을 구분선과 메타정보와 함께 `notes` 필드에 저장:

```
[카카오톡 | 홍길동 | 03/21 14:30]
메시지 내용 전문...
---
[SMS | 김철수 | 03/21 15:00]
메시지 내용 전문...
```

`PurchaseOrderForm`에서 `sourceMessageId` (단수) 대신 `sourceMessageIds` (복수)를 받아 처리하도록 변경한다. 주문의 `source_message_id`는 첫 번째 메시지 ID를 저장하고, notes에 모든 메시지 내용을 포함한다.

**메시지 조회:** `orders/new/page.tsx` (Server Component)에서 `source_message_ids` param을 파싱하고, `getMessageById()`를 병렬 호출하여 메시지 데이터를 조회한 뒤 `PurchaseOrderForm`에 초기 notes를 props로 전달한다.

**ID 타입 주의:** `captured_messages.id`는 DB에서 TEXT 타입이다. `UnifiedMessage.id`가 `Number()`로 변환되고 있으므로, `source_message_ids` 전달 시 원본 string ID를 사용해야 한다. `useRowSelection`에서 사용하는 ID도 string으로 통일한다.

**제한사항:** DB의 `orders.source_message_id`는 단수 TEXT 컬럼이므로 첫 번째 메시지 ID만 저장된다. 나머지 메시지와의 연결은 notes 텍스트에만 존재한다.

### 3. 캘린더 탭 연동

캘린더 탭은 유지하되, 목록 탭과 양방향으로 연동:

- **필터 동기화:** 목록 탭의 필터(출처, 날짜 범위, 상태)가 캘린더에도 동일하게 적용
- **네비게이션 연동:** 캘린더에서 메시지 클릭 시 목록 탭으로 전환 + 해당 메시지 아코디언 자동 열림

구현:
- 필터 상태를 URL searchParams로 관리 (현재와 동일)
- 캘린더 메시지 클릭 시 `?tab=list&highlight={messageId}` 형태로 라우팅
- 목록 탭에서 `highlight` param이 있으면 해당 행으로 스크롤 + 아코디언 열기 (`useEffect` + `scrollIntoView` + ref 사용)
- **필터 동기화 구현:** `messages/page.tsx`에서 `getMessagesForCalendar()`에도 `source_app` 등 필터 params를 전달하도록 변경. 캘린더 쿼리에 필터 조건을 추가한다.

### 4. AI 파싱 기능 전면 제거

**UI 제거:**
- `message-inbox/detail-panel.tsx` — "AI 파싱", "파싱 실행" 버튼, AI 테스트 결과 표시, `ParseResultTable` 컴포넌트
- `message-inbox/parse-result-table.tsx` — 파일 전체 삭제
- `message-inbox/index.tsx` — 일괄 파싱 버튼
- `messages-view.tsx` — 필터의 `parse_status` 옵션
- `message-inbox/list-panel.tsx` — parse_status 뱃지 표시

**서버 로직 제거:**
- `lib/parse-service.ts` — 파일 전체 삭제
- `lib/parser.ts` — 파일 전체 삭제
- `lib/ai-client.ts` — 파일 전체 삭제 (parse-service.ts와 test-parse에서만 사용)
- `lib/actions.ts` — `reparseMessage`, `reparseMessages` 함수 제거
- `app/api/test-parse/` — 라우트 전체 삭제
- `app/api/parse/` — 라우트 전체 삭제 (parse-service.ts, parser.ts 의존)

**쿼리 정리:**
- `lib/queries/messages.ts` — `mapCaptured()`에서 `parse_status`, `parse_result`, `parse_method` 등 legacy 매핑 제거
- `lib/types.ts` — `RawMessage` 인터페이스에서 파싱 관련 필드 제거 또는 optional 유지

**DB는 건드리지 않음:** `parse_status_enum` 등 DB 스키마는 그대로 둔다 (마이그레이션 위험 최소화).

## 컴포넌트 구조

### 제거할 파일
- `message-inbox/list-panel.tsx`
- `message-inbox/detail-panel.tsx`
- `message-inbox/order-panel.tsx`
- `message-inbox/parse-result-table.tsx`
- `message-inbox/filter-bar.tsx`
- `components/manual-parse-form.tsx`
- `lib/parse-service.ts`
- `lib/parser.ts`
- `lib/ai-client.ts`
- `app/api/test-parse/`
- `app/api/parse/`

### 새로 만들 파일
- `message-inbox/message-table.tsx` — 테이블 헤더 + 행 렌더링
- `message-inbox/message-row.tsx` — 개별 행 + 아코디언 상세
- `message-inbox/accordion-detail.tsx` — 펼침 영역 (내용, 메타, 코멘트, 액션)
- `message-inbox/bulk-action-bar.tsx` — 하단 플로팅 액션바

### 수정할 파일
- `message-inbox/index.tsx` — 3패널 → 테이블 구조로 교체, sidebar collapse 제거
- `messages-view.tsx` — 필터에서 parse_status 제거, `pendingCount` 계산 제거, highlight param 처리
- `messages/page.tsx` — parse_status searchParam 제거, 캘린더 쿼리에 필터 전달
- `messages/actions.ts` — `createManualOrder` 정리, 다중 메시지 주문 생성 함수 추가
- `orders/new/page.tsx` — 복수 `source_message_ids` param 처리, 메시지 조회 후 notes 생성
- `orders/actions.ts` — `source_message_id` 처리 로직 수정
- `components/purchase-order-form.tsx` — 복수 메시지 ID 수신, 초기 notes props 추가
- `lib/queries/messages.ts` — 파싱 관련 매핑 정리, `getMessagesForCalendar`에 필터 param 추가
- `lib/types.ts` — 파싱 관련 타입 정리, `UnifiedMessage.id`를 `string`으로 변경
- `lib/actions.ts` — 파싱 함수 제거
- `hooks/use-row-selection.ts` — ID 타입을 `string`으로 변경
- `components/message-calendar.tsx` — 메시지 클릭 시 목록 탭 연동 라우팅, parse_status 뱃지 제거

## 데이터 흐름

```
수신메시지 목록 탭
  ├─ 테이블 표시 (captured_messages → UnifiedMessage[])
  ├─ 행 클릭 → 아코디언 펼침 (클라이언트 상태)
  ├─ 체크박스 선택 → 하단 액션바 표시
  │   ├─ "주문 생성" 클릭
  │   │   → /orders/new?source_message_ids=id1,id2,id3
  │   │   → PurchaseOrderForm이 메시지 조회 → notes 자동 생성
  │   └─ "삭제" 클릭 → deleteMessages() server action
  └─ 필터 변경 → URL searchParams 갱신 → 서버 재조회

캘린더 탭
  ├─ 동일 필터 적용 (searchParams 공유)
  └─ 메시지 클릭 → /messages?tab=list&highlight={id}
      → 목록 탭 전환 + 해당 행 스크롤 + 아코디언 열기
```

## 엣지 케이스

- **페이지 간 선택 유지:** 페이지 이동 시 선택 상태가 리셋된다. 이는 현재 동작과 동일하며 허용한다.
- **아코디언 초기 상태:** 페이지 로드 시 아코디언은 모두 닫힌 상태. `highlight` param이 있을 때만 해당 행이 자동 펼침.
- **상태 필터:** `parse_status` 필터를 제거하고, `status_id` 기반 필터로 대체한다 (모바일 앱의 상태 단계 사용).

## 기존 코드 재활용

- `useRowSelection` 훅 — 그대로 사용
- `useMessageLocalState` 훅 — 핀, 코멘트, 상태 관리 그대로 사용
- `Pagination` 컴포넌트 — 그대로 사용
- `constants.ts` — SOURCE_LABEL, formatDateTime 그대로 사용
- `RealtimeListener` — 그대로 사용
- forecast 관련 기능 — 그대로 유지
