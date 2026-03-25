# Unified Order Price Forms Design

## Problem

주문 매입/매출 입력 양식이 3곳(주문생성, 주문목록 확장행, 주문상세)에서 서로 다른 컬럼 구조, 용어, VAT 처리 방식, 편집 가능 범위를 사용하고 있어 혼란을 초래한다.

## Goal

주문생성(`purchase-order-form.tsx`) 양식의 컬럼 구조와 계산 로직을 기준으로 3곳의 품목 테이블을 통일한다. 기준 양식 자체도 용어 변경("매출단가" -> "판매단가")과 하단 합계 보강이 필요하다.

## Decision Log

| 항목 | 결정 |
|------|------|
| VAT 처리 | 별도 컬럼 방식 (매입단가 + 매입VAT 컬럼) |
| 주문목록 가격 편집 | 편집 가능으로 변경 |
| 컬럼 범위 | 전체 통일 (매입단가~이익률 모두 표시) |
| 용어 | "판매단가"로 통일 (기존 "매출단가" 대체) |
| 하단 합계 | 병합 방식 (마진 + 공급가액/세액) |

## Unified Column Structure

3곳 모두 아래 컬럼을 동일한 순서로 표시한다:

| # | 컬럼명 | 편집 모드 | 읽기 모드 | 비고 |
|---|--------|-----------|-----------|------|
| 1 | 품목 | 선택/검색 | 텍스트 | 기존과 동일 |
| 2 | 수량 | Input (number) | 텍스트 | 기존과 동일 |
| 3 | 단위 | Select | 텍스트 | 주문목록에도 추가 |
| 4 | 매입처 | Combobox | 텍스트 | 기존과 동일 |
| 5 | 매입단가 | Input (number) | 텍스트 | VAT 미포함 |
| 6 | 매입(VAT) | Input (number) | 텍스트 | `= round(매입단가 * 1.1)`, 역입력 가능 |
| 7 | 매입총액 | 자동계산 | 텍스트 | `= 매입(VAT) * 수량` |
| 8 | 판매단가 | Input (number) | 텍스트 | 용어 통일: "판매단가" |
| 9 | 판매(VAT) | Input (number) | 텍스트 | `= round(판매단가 * 1.1)`, 역입력 가능 |
| 10 | 매출총액 | 자동계산 | 텍스트 | `= 판매(VAT) * 수량` |
| 11 | 매출이익 | 자동계산 | 텍스트 | `= 매출총액 - 매입총액` |
| 12 | 이익률 | 자동계산 | 텍스트 | `= 매출이익 / 매출총액 * 100`, 0이면 "-" 표시 |
| 13 | 담당자 | Input/텍스트 | 텍스트 | 기존과 동일 |
| 14 | KPIS | 상태 표시 | 상태 표시 | 주문목록/상세에서만 |

**"박스" 컬럼**: `order-table.tsx` 확장행에 기존 "박스" 컬럼이 있다. 이 컬럼은 유지하되, 통일 컬럼 구조에서 수량 다음(#2와 #3 사이)에 배치한다. 주문생성/상세에는 추가하지 않는다 (목록 전용).

## VAT Calculation Logic

### Canonical rounding rule

모든 VAT 계산은 **행별로 먼저 반올림한 뒤 합산**한다. 합산 후 반올림하지 않는다.

```
// Per-item (canonical)
purchaseVat = Math.round(purchase_price * 1.1)
sellingVat  = Math.round(unit_price * 1.1)

// Row totals
매입총액 = purchaseVat * quantity
매출총액 = sellingVat * quantity
```

### Forward calculation
```
매입(VAT) = Math.round(purchase_price * 1.1)
판매(VAT) = Math.round(unit_price * 1.1)
```

### Reverse input (VAT inclusive field edited directly)
```
purchase_price = Math.round(vatInclValue / 1.1)
unit_price     = Math.round(vatInclValue / 1.1)
```

역방향 입력 시 반올림으로 인해 재표시 시 1원 차이가 발생할 수 있다. 이는 기준 양식(purchase-order-form)과 동일한 동작이며 허용된다.

### Row calculations
```
매입총액 = Math.round(purchase_price * 1.1) * quantity
매출총액 = Math.round(unit_price * 1.1) * quantity
매출이익 = 매출총액 - 매입총액
이익률   = 매출총액 > 0 ? (매출이익 / 매출총액) * 100 : 0
```

이익률 표시: `매출총액 == 0`이면 "-" 표시 (0%가 아닌).

### Footer totals (merged format)

모든 합계는 행별 계산 결과를 합산한다 (`sum(per-item result)`).

```
매입합계:  sum(Math.round(purchase_price * 1.1) * quantity)
매출합계:  sum(Math.round(unit_price * 1.1) * quantity)
마진:      매출합계 - 매입합계 (금액 + %)
---
공급가액:  sum(unit_price * quantity)                         // VAT 미포함
세액:      sum(Math.round(unit_price * 0.1) * quantity)       // 행별 VAT 합산
합계:      공급가액 + 세액
```

**세액 계산**: 세액은 `매출합계 - 공급가액`이 아닌 `sum(Math.round(unit_price * 0.1) * quantity)`로 계산한다. 반올림 오차를 최소화하기 위함.

### DB storage
- `purchase_price`: 매입단가 (VAT 미포함) — 변경 없음
- `unit_price`: 판매단가 (VAT 미포함) — 변경 없음

**Local state 참고**: `purchase-order-form.tsx`는 로컬 state에서 `selling_price`를 사용하고 submit 시 `unit_price`로 매핑한다. `order-detail-client.tsx`와 `order-table.tsx`는 `unit_price`를 직접 사용한다.

## File Changes

### 1. `apps/web/src/components/order-table.tsx` (주문목록 확장행)

**현재 컬럼**: 품목, 수량, 박스, 매입처, 매입단가, 매입총액, 매출단가, 매출총액, 매출이익, 이익률, 담당자, KPIS

**변경 후 컬럼**: 품목, 수량, 박스, 단위, 매입처, 매입단가, 매입(VAT), 매입총액, 판매단가, 판매(VAT), 매출총액, 매출이익, 이익률, 담당자, KPIS

**추가:**
- 매입단가/판매단가 편집 Input (현재 읽기 전용 -> 편집 가능)
- 매입(VAT), 판매(VAT) 컬럼 추가
- 단위 컬럼 추가
- 하단 합계 영역 **신규 생성** (현재 accordion content에 합계 영역 없음)
- 테이블에 `overflow-x-auto` 추가 (컬럼 증가로 인한 가로 스크롤)

**변경:**
- "매출단가" -> "판매단가" 용어 변경
- 매입총액/매출총액 계산을 VAT 포함 방식으로 변경 (현재는 VAT 미포함)
- `handleSaveItems`에 `purchase_price`, `unit_price` 저장 로직 추가 (`updateOrderItemAction`이 이미 해당 필드를 지원함)
- `ItemEdits` interface에 `purchase_price`, `unit_price` 필드 추가
- 상단 요약행(summary row)의 매입총액/매출총액도 행별 반올림 합산으로 변경

### 2. `apps/web/src/components/order-detail-client.tsx` (주문상세)

**현재 컬럼**: #, 품목, 매입처, 수량, 단위, 매입단가, 판매단가, 금액, 담당자

**변경 후 컬럼**: #, 품목, 매입처, 수량, 단위, 매입단가, 매입(VAT), 매입총액, 판매단가, 판매(VAT), 매출총액, 매출이익, 이익률, 담당자

**추가:**
- 매입(VAT), 매입총액, 판매(VAT), 매출총액, 매출이익, 이익률 컬럼
- 하단 합계에 마진(금액+%) 추가
- 하단 합계의 공급가액/세액은 행별 VAT 합산 방식으로 변경 (기존: `supplyTotal * 0.1`)

**변경:**
- "판매단가" 유지 (이미 올바른 용어)
- VAT 토글 제거 -> 별도 컬럼 방식으로 교체 (동작 변경: 기존 토글 기반 -> 항상 양쪽 표시)
- VAT 토글 관련 코드 제거 (`vatInclusive` state, 토글 변환 로직)
- 하단 합계 계산이 VAT 미포함 기반에서 VAT 포함 기반으로 변경됨 (동작 변경)

### 3. `apps/web/src/components/purchase-order-form.tsx` (주문생성 — 기준 양식)

**현재 컬럼**: 품목, 수량, 단위, 매입처, 매입단가, 매입(VAT), 매입총액, 매출단가, 매출(VAT), 매출총액, 매출이익, 이익률, 담당자

**변경 후 컬럼**: (동일, 용어만 변경)

**변경:**
- "매출단가" -> "판매단가" 용어 변경
- "매출(VAT)" -> "판매(VAT)" 용어 변경
- 하단 합계에 공급가액/세액 추가 (기존 매입합계/매출합계/이익/이익률 아래에 구분선 후 추가)

### Not changed
- DB schema
- Server Actions (`actions.ts`, `orders/actions.ts`) — `updateOrderItemAction`이 이미 `purchase_price`, `unit_price` 지원
- 주문생성 폼의 아이템 추가/삭제 UI
- 주문 상태 관리
