# 주문·공급망 통합 설계 — 공급사/거래처 품목 연동 + 주문 강화

**Date**: 2026-03-10
**Status**: Approved
**Scope**: DB schema, supplier detail, hospital detail, message deletion, order creation enhancement

---

## 1. 개요

수신메시지에서 주문을 생성할 때 즐겨찾기 품목·거래처·공급사를 연동하고, 공급가 → 마진 → 납품가 → 할인율 가격 체계를 적용하는 통합 기능.

### 핵심 결정 사항

- **품목 단일화**: `mfds_items` (is_favorite=true)만 사용, `products` 테이블 제거
- **가격 흐름**: 공급가 → 마진 → 납품가 → 할인율 → 최종가
- **마진**: 거래처별 기본 마진율 + 품목별 납품가 오버라이드
- **할인**: 주문 전체 할인 + 품목별 추가 할인 (중복 적용)
- **메시지 삭제**: Soft delete (is_deleted = true, 모바일 동기화 반영)
- **거래처/공급사 추가**: 주문 폼 내 신규 등록 불가, 별도 관리 탭에서 등록 후 선택
- **MFDS 표시 컬럼**: 주문 아이템에 설정 기반 컬럼 값 복사 저장
- **상세 페이지**: `/suppliers/[id]`, `/hospitals/[id]` 별도 페이지

---

## 2. DB 스키마 변경

### 2.1 제거 대상

| 순서 | 대상 | 타입 | 이유 |
|------|------|------|------|
| 1 | `products_catalog` | VIEW | products 기반 → `DROP VIEW IF EXISTS products_catalog` |
| 2 | `order_items.box_spec_id` | COLUMN | product_box_specs FK → `ALTER TABLE order_items DROP COLUMN box_spec_id` |
| 3 | `product_box_specs` | TABLE | products FK 의존 |
| 4 | `product_aliases` | TABLE | products FK 의존 (00029에서 이미 제거되었을 수 있음, IF EXISTS 사용) |
| 5 | `product_suppliers` | TABLE | supplier_items로 대체 |
| 6 | `forecast_items.product_id` FK | CONSTRAINT | products FK → `ALTER TABLE forecast_items DROP COLUMN product_id` (mfds_item_id로 대체) |
| 7 | `products` | TABLE | mfds_items로 대체 → `DROP TABLE products CASCADE` |

순서: VIEW → FK 의존 컬럼 제거 → 자식 테이블 → 부모 테이블

**주의사항:**
- `forecast_items.product_id`를 `mfds_item_id BIGINT REFERENCES mfds_items(id)`로 교체
- `DROP TABLE products CASCADE`는 남아있는 암묵적 FK도 정리

### 2.2 신규 테이블

#### `supplier_items` — 공급사별 취급 품목

```sql
CREATE TABLE supplier_items (
  id            SERIAL PRIMARY KEY,
  supplier_id   INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  mfds_item_id  BIGINT NOT NULL REFERENCES mfds_items(id) ON DELETE CASCADE,
  purchase_price DECIMAL(12,2),
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, mfds_item_id)
);

CREATE INDEX idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX idx_supplier_items_mfds_item ON supplier_items(mfds_item_id);
```

#### `hospital_items` — 거래처별 거래 품목

```sql
CREATE TABLE hospital_items (
  id             SERIAL PRIMARY KEY,
  hospital_id    INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  mfds_item_id   BIGINT NOT NULL REFERENCES mfds_items(id) ON DELETE CASCADE,
  delivery_price DECIMAL(12,2),  -- NULL이면 마진율 자동 계산
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, mfds_item_id)
);

CREATE INDEX idx_hospital_items_hospital ON hospital_items(hospital_id);
CREATE INDEX idx_hospital_items_mfds_item ON hospital_items(mfds_item_id);
```

### 2.3 기존 테이블 수정

#### `hospitals` — 기본 마진율 추가

```sql
ALTER TABLE hospitals ADD COLUMN default_margin_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
```

#### `orders` — 주문 전체 할인율 추가

```sql
ALTER TABLE orders ADD COLUMN discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
```

#### `order_items` — 품목 참조 변경 + 할인/가격 컬럼

```sql
-- 레거시 컬럼 제거 (box_spec_id는 2.1에서 먼저 처리)
ALTER TABLE order_items DROP COLUMN IF EXISTS unit_type;
ALTER TABLE order_items DROP COLUMN IF EXISTS calculated_pieces;
ALTER TABLE order_items DROP COLUMN IF EXISTS original_text;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_confidence;

-- product_id → mfds_item_id 변경
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items RENAME COLUMN product_id TO mfds_item_id;
ALTER TABLE order_items ALTER COLUMN mfds_item_id TYPE BIGINT;
ALTER TABLE order_items ADD CONSTRAINT order_items_mfds_item_id_fkey
  FOREIGN KEY (mfds_item_id) REFERENCES mfds_items(id);

-- 신규 컬럼
ALTER TABLE order_items ADD COLUMN discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN display_columns JSONB;
ALTER TABLE order_items ADD COLUMN final_price DECIMAL(12,2);
```

**유지 컬럼:** `id`, `order_id`, `mfds_item_id` (renamed), `supplier_id`, `quantity`, `unit_price` (납품가 스냅샷), `purchase_price` (공급가 스냅샷), `line_total`, `created_at`
**신규 컬럼:** `discount_rate`, `display_columns`, `final_price`
**제거 컬럼:** `box_spec_id`, `unit_type`, `calculated_pieces`, `original_text`, `match_status`, `match_confidence`

#### `forecast_items` — 품목 참조 변경

```sql
ALTER TABLE forecast_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE forecast_items ADD COLUMN mfds_item_id BIGINT REFERENCES mfds_items(id);
```

#### `mfds_items` — raw_data 컬럼 보장

```sql
ALTER TABLE mfds_items ADD COLUMN IF NOT EXISTS raw_data JSONB;
```

### 2.4 가격 계산 공식

```
기본_납품가 = hospital_items.delivery_price
             ?? (supplier_items.purchase_price × (1 + hospitals.default_margin_rate / 100))

최종_단가 = 기본_납품가 × (1 - orders.discount_rate / 100) × (1 - order_items.discount_rate / 100)

line_total = 최종_단가 × quantity
```

---

## 3. 공급사 상세 페이지 (`/suppliers/[id]`)

### 페이지 구조

```
/suppliers/[id]
├── 상단: 공급사 기본 정보 (이름, 연락처, 사업자번호 등) — 편집 가능
├── 섹션: "취급 품목"
│   ├── [+ 품목 추가] 버튼 → ItemPickerModal
│   ├── 품목 테이블
│   │   ├── 품목명 | 제조사 | 유형(drug/device) | 공급가(인라인 편집) | 주공급사 토글 | 삭제
│   └── 빈 상태: "즐겨찾기 품목에서 이 공급사의 취급 품목을 추가하세요"
└── 하단: 저장/취소
```

### 서버 액션

- `getSupplierItems(supplierId)` — 취급 품목 목록
- `addSupplierItems(supplierId, mfdsItemIds[])` — 품목 추가
- `updateSupplierItem(id, { purchase_price, is_primary })` — 공급가/주공급사 수정
- `removeSupplierItem(id)` — 품목 연결 해제

---

## 4. 거래처 상세 페이지 (`/hospitals/[id]`)

### 페이지 구조

```
/hospitals/[id]
├── 상단: 거래처 기본 정보 + default_margin_rate 편집 필드
├── 섹션: "거래 품목"
│   ├── [+ 품목 추가] 버튼 → ItemPickerModal (동일 컴포넌트)
│   ├── 품목 테이블
│   │   ├── 품목명 | 제조사 | 유형 | 공급가(참조, 읽기전용) | 마진율 | 납품가(편집) | 삭제
│   │   ├── 공급가: supplier_items에서 is_primary=true인 공급사의 가격
│   │   └── 납품가: NULL → 자동계산 표시(회색, "자동" 뱃지) / 직접입력 → 굵은 글씨
│   └── 빈 상태: "즐겨찾기 품목에서 거래 품목을 추가하세요"
└── 하단: 저장/취소
```

### 납품가 표시 로직

```
if hospital_items.delivery_price != NULL:
  → 직접 입력값 (굵은 글씨)
else if 주공급사 공급가 존재:
  → 공급가 × (1 + margin_rate/100) (회색, "자동" 뱃지)
else:
  → "공급가 미등록" 경고
```

### 서버 액션

- `getHospitalItems(hospitalId)` — 거래 품목 + 주공급사 공급가 JOIN + `hospitals.default_margin_rate` 반환 (UI의 "마진율" 컬럼은 거래처 기본값을 표시하는 display-computed 값)
- `addHospitalItems(hospitalId, mfdsItemIds[])` — 품목 추가
- `updateHospitalItem(id, { delivery_price })` — 납품가 수정
- `removeHospitalItem(id)` — 품목 연결 해제

---

## 5. 재사용 컴포넌트: `ItemPickerModal`

즐겨찾기 품목을 검색·선택하는 모달. 공급사·거래처 상세 페이지에서 공용.

```
ItemPickerModal
├── 검색 입력 (품목명, 제조사, 표준코드)
├── 필터: drug | device | 전체
├── 결과 테이블: 체크박스 | 품목명 | 제조사 | 표준코드 | 유형
├── 이미 추가된 품목은 비활성(disabled) 표시
└── [선택 추가] 버튼
```

Props: `onSelect(mfdsItemIds[])`, `excludeIds[]` (이미 추가된 품목)

---

## 6. 수신메시지 삭제

### 단건 삭제

메시지 상세 패널(`detail-panel.tsx`)에 삭제 버튼 추가.

### 일괄 삭제

메시지 목록에 체크박스 추가 → `bulk-action-bar.tsx` 패턴으로 벌크 삭제 바 표시.

### 동작

```sql
UPDATE captured_messages SET is_deleted = true WHERE id = ANY($1);
```

확인 다이얼로그 → 실행 → revalidatePath. 모바일 동기화 시 is_deleted 반영.

---

## 7. 주문 생성 강화

### 7.1 단건 (메시지 상세 → 주문 생성)

기존 `OrderInlineForm` 확장:

```
OrderInlineForm (강화)
├── 거래처 선택 (Combobox)
├── 주문일 / 납품일
├── 주문 전체 할인율 [___]%
├── 품목 섹션
│   ├── [+ 즐겨찾기에서 추가] 버튼
│   │   └── 거래처 선택됨 → hospital_items 품목만 표시
│   │       거래처 미선택 → 전체 즐겨찾기 표시
│   ├── 품목 라인 (각 행)
│   │   ├── 품목명 | 수량 | 공급사 선택 | 공급가(참조)
│   │   ├── 납품가(자동/수동) | 품목별 할인율 [___]%
│   │   ├── 최종단가 (자동계산, 읽기전용)
│   │   ├── MFDS 표시 컬럼 (설정 기반, 읽기전용)
│   │   └── 삭제 버튼
│   └── 합계: 공급가 합계 | 납품가 합계 | 할인 적용 최종 합계
├── 메모
└── [주문 생성]
```

### 7.2 일괄 (메시지 목록 다중 선택)

벌크 액션 바에 [주문 생성] 버튼 추가. 선택한 메시지 ID 배열을 OrderInlineForm에 전달. 메시지 내용을 참조 정보로 표시.

### 7.3 가격 자동 계산 흐름

```
1. 거래처 선택 → hospital.default_margin_rate 로드
2. [+ 즐겨찾기에서 추가] → hospital_items 품목 목록 표시
3. 품목 선택 시:
   a. 공급사 자동 선택: supplier_items에서 is_primary=true
   b. 공급가: supplier_items.purchase_price
   c. 납품가: hospital_items.delivery_price ?? (공급가 × (1 + 마진율/100))
   d. 최종단가: 납품가 × (1 - 주문할인/100) × (1 - 품목할인/100)
4. 공급사 수동 변경 → 공급가 재로드 → 납품가 재계산
5. MFDS 표시 컬럼: settings.order_display_columns 기반, mfds_items.raw_data에서 추출
```

### 7.4 주문 저장 시 스냅샷

order_items에 저장하는 값:
- `mfds_item_id` — 품목 참조
- `supplier_id` — 선택된 공급사
- `purchase_price` — 당시 공급가 스냅샷
- `unit_price` — 당시 납품가 스냅샷
- `discount_rate` — 품목별 할인율
- `final_price` — 최종 단가
- `display_columns` — MFDS 컬럼 값 JSONB 스냅샷
- `line_total` — final_price × quantity

---

## 8. 파일 변경 목록

### 신규 파일

| 파일 | 용도 |
|------|------|
| `packages/supabase/.../00039_order_supply_chain.sql` | 통합 마이그레이션 |
| `apps/web/src/app/(dashboard)/suppliers/[id]/page.tsx` | 공급사 상세 페이지 |
| `apps/web/src/app/(dashboard)/hospitals/[id]/page.tsx` | 거래처 상세 페이지 |
| `apps/web/src/components/supplier-detail.tsx` | 공급사 상세 컴포넌트 |
| `apps/web/src/components/hospital-detail.tsx` | 거래처 상세 컴포넌트 |
| `apps/web/src/components/item-picker-modal.tsx` | 품목 선택 모달 (공용) |
| `apps/web/src/lib/queries/supplier-items.ts` | 공급사 품목 쿼리 |
| `apps/web/src/lib/queries/hospital-items.ts` | 거래처 품목 쿼리 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `apps/web/src/lib/actions.ts` | deleteMessages, supplier/hospital items CRUD 액션 추가 |
| `apps/web/src/app/(dashboard)/orders/actions.ts` | createOrderAction 확장 (할인율, display_columns, final_price) |
| `apps/web/src/components/order-inline-form.tsx` | 즐찾 품목 추가, 할인율, 가격 자동계산 |
| `apps/web/src/components/order-table.tsx` | mfds_item_id 참조, 할인율/최종가 표시 |
| `apps/web/src/components/order-detail-client.tsx` | 동일 |
| `apps/web/src/components/messages-view.tsx` | 체크박스 + 벌크 삭제/주문생성 |
| `apps/web/src/components/message-inbox/detail-panel.tsx` | 삭제 버튼 |
| `apps/web/src/components/supplier-list.tsx` | 행 클릭 → /suppliers/[id] 이동 |
| `apps/web/src/components/hospital-list.tsx` | 행 클릭 → /hospitals/[id] 이동 |
| `apps/web/src/lib/types.ts` | SupplierItem, HospitalItem 타입 추가, OrderItem 수정 |
| `apps/web/src/lib/queries/orders.ts` | mfds_item_id JOIN 변경 |
| `apps/web/src/lib/queries/products.ts` | `getProductsCatalog()` → `mfds_items WHERE is_favorite = true` 직접 조회로 변경 (products_catalog VIEW 제거됨) |
| `apps/web/src/lib/queries/forecasts.ts` | forecast_items JOIN을 mfds_item_id 기반으로 변경 |

---

## 9. 구현 순서

```
Phase A: DB 스키마 + 공급사-품목 연동
  1. 마이그레이션 작성·실행
  2. types.ts 업데이트
  3. supplier-items 쿼리·액션
  4. ItemPickerModal 컴포넌트
  5. /suppliers/[id] 페이지 + SupplierDetail 컴포넌트
  6. supplier-list.tsx 행 클릭 링크 추가

Phase B: 거래처-품목 연동
  7. hospital-items 쿼리·액션
  8. /hospitals/[id] 페이지 + HospitalDetail 컴포넌트
  9. hospital-list.tsx 행 클릭 링크 추가

Phase C: 수신메시지 삭제 + 주문 생성 강화
  10. deleteMessages 액션 + UI (단건/일괄)
  11. OrderInlineForm 확장 (즐찾 품목 추가, 할인율, 가격 계산)
  12. 주문 테이블/상세 뷰 mfds_item_id 대응
  13. 일괄 주문 생성 (벌크 메시지 선택)
```

---

## 10. 영향 받는 기존 기능 (확인 필요)

- **kpis_reports**: `order_item_id → order_items` FK 체인은 유지됨. `kpis_reports` 자체 스키마 변경 없음. 다만 기존 코드에서 `order_items.product_id` JOIN이 있으면 `mfds_item_id`로 변경 필요.
- **forecast_items**: `product_id` → `mfds_item_id`로 교체. 기존 forecast 데이터의 product_id 값은 유실됨 (신규 시스템에서는 mfds_item_id 기준).

---

## 11. 스펙 외 사항 (YAGNI)

- 삭제 메시지 복구 기능
- 공급가 변경 시 납품가 자동 재계산 알림
- 주문서 PDF 생성
- 품목 가격 이력 추적
