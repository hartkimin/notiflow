# Order Creation Page Design (`/orders/new`)

## Overview

주문 생성을 위한 전용 페이지. 거래처(병원)에 납품할 품목을 선택하고, 공급사별 매입가/판매가/마진을 확인하며 주문을 생성한다.

## Requirements

### Core Flow
1. 거래처(hospital) 검색 후 선택
2. 품목 선택: 거래처 등록 품목 / 공급사별 품목 / 내 품목 / 식약처 전체 검색
3. 품목별 공급사 선택 (매입가 자동 반영)
4. 수량, 단위(드롭다운+수동입력), 판매가, 마진, 총합 확인
5. 설정에서 지정한 추가 컬럼 표시
6. KPIS 신고번호 수동 입력 가능
7. 주문 생성 (draft 상태)

### Business Rules
- 주문번호: `generate_order_number()` RPC로 자동 생성 (ORD-YYYYMMDD-###)
- 마진 = 판매가 - 매입가
- 마진율 = (마진 / 판매가) × 100%
- 총합(line_total) = 판매가 × 수량
- 매입가: `product_suppliers.purchase_price` (공급사별)
- 판매가: `hospital_products.selling_price` (거래처별) 또는 수동 입력
- 단위 옵션: 개, 박스, 팩, 세트, 병, 앰플, 바이알 + 직접입력

### Price Column Mapping (중요)
DB 컬럼과 UI 용어의 명확한 매핑:

| UI 용어 | DB 컬럼 | 설명 |
|---------|---------|------|
| 매입가 (공급사 가격) | `order_items.purchase_price` | `product_suppliers.purchase_price`에서 가져옴 |
| 판매가 (거래처 가격) | `order_items.unit_price` | `hospital_products.selling_price`에서 가져옴 또는 수동 입력 |
| 총합 | `order_items.line_total` | 판매가(unit_price) × 수량 |

- `order_items.unit_price` = 판매가 (거래처에 청구하는 가격)
- `order_items.purchase_price` = 매입가 (공급사에서 사들이는 가격)
- `orders.total_amount` = Σ(line_total) — 주문 생성 시 합산하여 저장

## Database Changes

### New Table: `hospital_products`

```sql
CREATE TABLE hospital_products (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  product_id      INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  selling_price   DECIMAL(12,2),
  default_quantity INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, product_id)
);

CREATE INDEX idx_hospital_products_hospital ON hospital_products(hospital_id);
CREATE INDEX idx_hospital_products_product ON hospital_products(product_id);

-- Auto-update trigger
CREATE TRIGGER trg_hospital_products_updated
  BEFORE UPDATE ON hospital_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE hospital_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hospital_products"
  ON hospital_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert hospital_products"
  ON hospital_products FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update hospital_products"
  ON hospital_products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete hospital_products"
  ON hospital_products FOR DELETE TO authenticated USING (true);
```

**default_quantity 사용**: 거래처 품목 탭에서 품목 추가 시 수량 입력란에 기본값으로 자동 채움. 사용자가 수정 가능.

### TypeScript Type Updates

```typescript
// types.ts에 추가
export interface OrderItem {
  // ... 기존 필드
  purchase_price: number | null;  // 추가: 매입가
}

export interface OrderItemFlat {
  // ... 기존 필드
  purchase_price: number | null;  // 추가: 매입가
}
```

### Existing Tables Used
- `product_suppliers` — 공급사별 품목 + 매입가 (purchase_price)
- `kpis_reports.reference_number` — KPIS 신고번호 (이미 존재)
- `order_items.unit_type` — VARCHAR(20), 새 단위값 저장 가능 (max 20자 UI 검증)
- `order_items.purchase_price` — DECIMAL(12,2), 이미 존재 (매입가 저장용)
- `order_display_columns` setting — 설정 컬럼 표시용

## Product ID Resolution Strategy (중요)

품목 소스별로 `products.id`를 어떻게 확보하는지 명확히 정의.

### Tab 1 (거래처 품목) & Tab 2 (공급사별 품목)
- `hospital_products.product_id` / `product_suppliers.product_id` → 이미 `products.id` FK
- 직접 사용 가능

### Tab 3 (내 품목: my_drugs / my_devices)
- `my_drugs`/`my_devices` 테이블은 `products`와 직접 FK 없음
- **Resolution**: 검색 결과에 `products.id`를 같이 반환
  - `products` 테이블의 `mfds_item_id` 또는 `standard_code`로 매칭
  - 매칭되는 product가 있으면 해당 `products.id` 사용
  - 없으면 `products` 테이블에 자동 INSERT 후 신규 ID 반환
  - 자동 INSERT 시: name=item_name, standard_code, manufacturer 등 기본 정보 복사

### Tab 4 (식약처 검색)
- `mfds_items` 테이블에서 검색
- `products.mfds_item_id`로 매칭 시도
- 매칭되면 기존 `products.id` 사용
- 없으면 `products` 테이블에 자동 INSERT (name, manufacturer, standard_code, mfds_item_id 설정)

### Auto-Insert 로직 (Server Action)

```typescript
async function resolveProductId(source: {
  type: 'my_drug' | 'my_device' | 'mfds';
  sourceId: number;
  name: string;
  manufacturer?: string;
  standardCode?: string;
}): Promise<number> {
  // 1. 기존 products에서 standard_code 또는 mfds_item_id로 검색
  // 2. 있으면 해당 id 반환
  // 3. 없으면 INSERT INTO products → 신규 id 반환
}
```

## Backward Compatibility

### 기존 order-inline-form.tsx 유지
- 기존 `createOrderAction` (my_item_id + my_item_type 기반)은 그대로 유지
- 새 페이지용으로 `createOrderWithDetailsAction`을 별도로 추가
- 기존 인라인 폼은 간편 주문용으로 병행 사용 (추후 통합 가능)

### 신규 Server Action

```typescript
// 새 주문 생성 (전체 상세 정보 포함)
"use server"
async function createOrderWithDetailsAction(input: {
  hospital_id: number;
  order_date: string;
  delivery_date: string | null;
  delivered_at: string | null;
  notes: string | null;
  source_message_id: string | null;
  items: Array<{
    product_id: number;
    supplier_id: number | null;
    quantity: number;
    unit_type: string;
    purchase_price: number | null;  // 매입가
    unit_price: number | null;       // 판매가 (= selling price)
    kpis_reference_number: string | null;
  }>;
}) {
  // 1. generate_order_number() RPC 호출
  // 2. INSERT orders (total_amount = Σ(unit_price * quantity))
  // 3. INSERT order_items (product_id, supplier_id, quantity, unit_type,
  //      unit_price, purchase_price, line_total = unit_price * quantity)
  //    → .insert().select("id") 로 신규 ID 배열 확보
  // 4. kpis_reference_number가 있는 items에 대해:
  //    INSERT kpis_reports (order_item_id = step3에서 받은 id,
  //      reference_number, report_status = 'pending')
  // 5. revalidatePath("/orders")
}
```

## Page Layout

### URL
`/orders/new`
Optional query param: `?source_message_id=xxx` (메시지에서 주문 생성 시)

### Structure

```
┌──────────────────────────────────────────────────────┐
│ ← 주문관리    새 주문 생성               [취소] [생성] │
├──────────────────────────────────────────────────────┤
│ Section 1: 기본 정보                                  │
│ [거래처 검색▼]  [주문일 📅]  [배송예정일 📅]  [실배송일 📅] │
├──────────────────────────────────────────────────────┤
│ Section 2: 품목 추가                                  │
│ ┌────────────┬──────────────┬─────────┬──────────┐   │
│ │ 거래처 품목 │ 공급사별 품목 │ 내 품목  │ 식약처검색│   │
│ └────────────┴──────────────┴─────────┴──────────┘   │
│                                                      │
│ (탭 별 콘텐츠: 검색/선택 UI)                           │
├──────────────────────────────────────────────────────┤
│ Section 3: 주문 품목 테이블                            │
│ ┌────┬────┬──┬──┬───┬───┬───┬───┬─────┬────┬─┐      │
│ │품목│공급사│수량│단위│매입│판매│마진│총합│설정컬럼│KPIS│X│      │
│ ├────┼────┼──┼──┼───┼───┼───┼───┼─────┼────┼─┤      │
│ │... │▼   │  │▼ │   │   │   │   │     │    │×│      │
│ └────┴────┴──┴──┴───┴───┴───┴───┴─────┴────┴─┘      │
├──────────────────────────────────────────────────────┤
│ Section 4: 하단                                      │
│ [메모]                    총매입: ₩xxx  총판매: ₩xxx  │
│                           총마진: ₩xxx  (마진율 xx%)  │
└──────────────────────────────────────────────────────┘
```

## Component Architecture

### File Structure

```
app/(dashboard)/orders/new/
  page.tsx                          — Server Component: 데이터 로드, 레이아웃

components/
  order-create-form.tsx             — Client Component: 전체 폼 상태 관리
  order-create-item-selector.tsx    — 품목 선택 탭 UI (4개 탭)
  order-create-item-table.tsx       — 선택된 품목 테이블 (마진 계산 포함)

lib/queries/
  hospital-products.ts              — 거래처별 품목 쿼리

app/(dashboard)/orders/
  actions.ts                        — 기존 파일에 신규 액션 추가
```

### Data Flow

```
page.tsx (Server)
  ├─ getOrderDisplayColumns()       → displayColumns
  └─ render <OrderCreateForm displayColumns={...} />

OrderCreateForm (Client)
  ├─ state: hospitalId, orderDate, deliveryDate, deliveredAt, notes
  ├─ state: selectedItems[] (품목 + 공급사 + 가격 정보)
  │
  ├─ <Section 1> 기본 정보 (hospital combobox, date inputs)
  ├─ <OrderCreateItemSelector hospitalId={hospitalId}>
  │     ├─ Tab 1: 거래처 품목 → getHospitalProductsAction(hospitalId)
  │     │    거래처 선택 시 로드, 등록품목 + 주문이력 품목 표시
  │     │    판매가(selling_price) + 기본수량(default_quantity) 자동 반영
  │     │
  │     ├─ Tab 2: 공급사별 품목 → getSupplierProductsAction(supplierId)
  │     │    공급사 선택 드롭다운 → 해당 공급사 취급품목 리스트
  │     │    매입가(purchase_price) 포함 표시
  │     │    선택 시 공급사 + 매입가 자동 지정
  │     │
  │     ├─ Tab 3: 내 품목 → searchMyItemsAction(query)
  │     │    기존 검색 로직 재사용
  │     │    선택 시 resolveProductId()로 products.id 확보
  │     │
  │     └─ Tab 4: 식약처 검색 → 기존 searchMfdsItemsAction 재사용
  │          검색 결과에서 선택 시 resolveProductId()로 products.id 확보
  │
  │     모든 탭 공통:
  │       품목 선택 → getProductSuppliersAction(productId) → 공급사 목록 + 매입가
  │       → selectedItems에 추가
  │
  ├─ <OrderCreateItemTable items={selectedItems}>
  │     ├─ 공급사 드롭다운 ("공급사명 — ₩매입가" 형태)
  │     ├─ 수량 입력 (default_quantity 있으면 기본값)
  │     ├─ 단위 드롭다운 (7개 + 직접입력, max 20자)
  │     ├─ 매입가 (공급사 선택 시 자동, 수동 편집 가능)
  │     ├─ 판매가 (hospital_products에서 자동, 수동 편집 가능)
  │     ├─ 마진 (자동계산: 판매가 - 매입가, 읽기전용)
  │     ├─ 총합 (판매가 × 수량, 읽기전용)
  │     ├─ 설정 컬럼 (displayColumns 기반, 읽기전용)
  │     ├─ KPIS 번호 입력 (텍스트, max 100자)
  │     └─ 삭제 버튼
  │
  └─ <Section 4> 메모 + 합계
       ├─ 총 매입액: Σ(매입가 × 수량) — 클라이언트 계산
       ├─ 총 판매액: Σ(판매가 × 수량) — 클라이언트 계산, orders.total_amount로 저장
       ├─ 총 마진: 총판매액 - 총매입액 — 클라이언트 계산
       ├─ 마진율: (총마진 / 총판매액) × 100% — 클라이언트 계산
       └─ 생성 버튼 → createOrderWithDetailsAction()
```

### Server Actions (new)

```typescript
// 1. 거래처별 등록 품목 조회
getHospitalProductsAction(hospitalId: number)
  → hospital_products JOIN products LEFT JOIN product_suppliers
  → returns: { product_id, name, selling_price, default_quantity,
  →            suppliers: [{supplier_id, supplier_name, purchase_price}] }[]

// 2. 거래처 과거 주문 이력 품목 (최근 6개월)
getHospitalOrderHistoryAction(hospitalId: number)
  → order_items JOIN orders WHERE hospital_id AND order_date > 6mo ago
  → GROUP BY product_id, 빈도순 정렬
  → hospital_products에 이미 있는 품목은 제외
  → returns: { product_id, name, order_count, last_ordered }[]

// 3. 공급사별 취급 품목 조회
getSupplierProductsAction(supplierId: number)
  → product_suppliers JOIN products WHERE supplier_id = supplierId
  → returns: { product_id, name, purchase_price, is_primary }[]

// 4. 품목의 보유 공급사 목록 + 매입가
getProductSuppliersAction(productId: number)
  → product_suppliers JOIN suppliers WHERE product_id = productId
  → returns: { supplier_id, supplier_name, purchase_price, is_primary }[]

// 5. 품목 ID 확보 (my_drugs/my_devices/mfds → products.id)
resolveProductIdAction(source: {
  type: 'my_drug' | 'my_device' | 'mfds';
  sourceId: number;
  name: string;
  manufacturer?: string;
  standardCode?: string;
})
  → products에서 standard_code/mfds_item_id로 매칭
  → 있으면 기존 id 반환, 없으면 INSERT → 신규 id 반환

// 6. 주문 생성 (신규, 기존 createOrderAction과 별도)
createOrderWithDetailsAction(input)
  → Step 1: generate_order_number() RPC
  → Step 2: INSERT orders (total_amount 포함)
  → Step 3: INSERT order_items → .select("id")로 ID 배열 확보
  → Step 4: KPIS reference_number 있는 items → INSERT kpis_reports
  → Step 5: revalidatePath("/orders")
```

## Item Selection Flow Detail

### Tab 1: 거래처 품목
- 거래처 선택 후 활성화 (미선택 시 "거래처를 먼저 선택하세요" 안내)
- 상단: `hospital_products` 등록 품목 (selling_price, default_quantity 포함)
- 하단(구분선): 과거 주문 이력 품목 (최근 6개월, 빈도순, 등록품목 제외)
- 체크박스로 선택 → 테이블에 추가
- 판매가(`selling_price`), 기본수량(`default_quantity`) 자동 반영

### Tab 2: 공급사별 품목
- 공급사 SearchableCombobox (기존 searchSuppliersAction 재사용)
- 선택한 공급사의 `product_suppliers` 품목 리스트 표시
- 매입가(`purchase_price`) 포함
- 선택 시 공급사 + 매입가 자동 지정

### Tab 3: 내 품목
- 기존 `searchMyItemsAction` 활용
- 검색바로 my_drugs + my_devices 통합 검색
- 선택 시 `resolveProductIdAction()`으로 products.id 확보
- 공급사 드롭다운에서 공급사 지정

### Tab 4: 식약처 검색
- 기존 MFDS DB 검색 (`mfds_items` 테이블) 활용
- 검색 결과에서 품목 선택 시 `resolveProductIdAction()`으로 products.id 확보
- 공급사 드롭다운에서 공급사 지정

## Unit Type Dropdown

### Options
```typescript
const UNIT_OPTIONS = [
  { value: "piece", label: "개" },
  { value: "box", label: "박스" },
  { value: "pack", label: "팩" },
  { value: "set", label: "세트" },
  { value: "bottle", label: "병" },
  { value: "ampoule", label: "앰플" },
  { value: "vial", label: "바이알" },
] as const;
```

- 드롭다운 마지막에 "직접입력" 옵션
- 선택 시 텍스트 입력 필드로 전환 (max 20자)
- 입력값이 `order_items.unit_type`에 저장

## Configurable Columns

기존 `settings.order_display_columns` 활용:
- drug: ["ITEM_NAME", "BAR_CODE", "ENTP_NAME", "EDI_CODE"]
- device: ["PRDLST_NM", "UDIDI_CD", "MNFT_IPRT_ENTP_NM", "CLSF_NO_GRAD_CD"]

품목의 raw 데이터에서 해당 컬럼값을 추출하여 테이블에 추가 컬럼으로 표시.
기존 `order-inline-form.tsx`의 `getDisplayHeaders()` / `getColumnValue()` 로직 재사용.

## KPIS Reference Number

- 각 품목 행에 선택적 텍스트 입력 필드 (max 100자)
- 주문 생성 시:
  1. `order_items` INSERT → `.select("id")`로 각 item의 신규 ID 확보
  2. `kpis_reference_number`가 있는 item에 대해:
     `INSERT INTO kpis_reports (order_item_id, reference_number, report_status)`
     VALUES (step1에서 받은 id, 입력값, 'pending')
- 기존 `kpis_reports` 테이블의 `reference_number VARCHAR(100)` 컬럼 활용

## Summary Section

```
총 매입액: Σ(매입가 × 수량)     — 클라이언트 계산 (DB 미저장)
총 판매액: Σ(판매가 × 수량)     — 클라이언트 계산, orders.total_amount로 저장
총 마진:   총판매액 - 총매입액    — 클라이언트 계산 (DB 미저장)
마진율:    (총마진 / 총판매액) × 100% — 클라이언트 계산 (DB 미저장)
```

## Error Handling

- 거래처 미선택 → "거래처를 선택해주세요"
- 품목 0건 → "품목을 추가해주세요"
- 수량 0 이하 → 행별 유효성 검사
- 판매가 미입력 → 경고 표시 (0원으로 처리 허용)
- 공급사 미선택 → 허용 (supplier_id nullable)
- 단위 직접입력 20자 초과 → 입력 제한
- KPIS 번호 100자 초과 → 입력 제한
- 네트워크 에러 → toast 에러 메시지

## Migration Plan

1. `00037_hospital_products.sql` — 새 테이블 + 인덱스 + RLS + updated_at 트리거
2. 기존 `order_items` 테이블 변경 없음 (unit_type VARCHAR(20), purchase_price DECIMAL(12,2) 이미 존재)
3. 기존 `kpis_reports.reference_number` 활용 (변경 없음)
4. `OrderItem`, `OrderItemFlat` TypeScript 타입에 `purchase_price` 필드 추가

## Known Issues

- `generate_order_number()` RPC는 COUNT 기반으로 동시 호출 시 중복 가능성 있음 (기존 이슈, 이번 스코프 외)
