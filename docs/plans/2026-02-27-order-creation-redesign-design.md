# 주문 생성 리디자인 설계

## 개요

주문 생성 시 `my_drugs`/`my_devices`에서 품목을 검색·선택하고, 선택된 4개 컬럼을 표시하며, 컬럼 설정을 DB에 영속화하는 기능. 메시지 파싱 기능은 전면 삭제하되 AI 연결 인프라는 유지.

## 접근 방식

점진적 마이그레이션: 삭제 → 가격 컬럼 추가 → 설정 기능 → 주문 생성 폼

---

## 섹션 1: DB 마이그레이션 — 삭제

### 마이그레이션 00030: 메시지 파싱 관련 제거

```sql
-- 1. orders.message_id FK 및 컬럼 제거
ALTER TABLE orders DROP COLUMN message_id;

-- 2. order_items에서 파싱 관련 컬럼 제거
ALTER TABLE order_items
  DROP COLUMN original_text,
  DROP COLUMN match_status,
  DROP COLUMN match_confidence;

-- 3. match_status_enum 타입 제거
DROP TYPE match_status_enum;

-- 4. raw_messages 테이블 제거
DROP TABLE raw_messages;
```

### 삭제할 Edge Functions

- `parse-message/`
- `test-parse/`

### 삭제할 웹 앱 코드

- 메시지 관련 페이지 (라우트 전체)
- 네비게이션에서 메시지 메뉴 제거
- `AISettingsForm`에서 파싱 전용 설정 제거 (AI 연결 인프라 유지)
- 관련 서버 액션, 쿼리, 타입 정리

---

## 섹션 2: DB 마이그레이션 — 추가

### 마이그레이션 00031: 가격 컬럼 추가 & 주문번호 자동생성

```sql
-- 1. my_drugs에 가격 컬럼 추가
ALTER TABLE my_drugs ADD COLUMN unit_price DECIMAL(12,2);

-- 2. my_devices에 가격 컬럼 추가
ALTER TABLE my_devices ADD COLUMN unit_price DECIMAL(12,2);

-- 3. 주문번호 자동생성 함수
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := to_char(CURRENT_DATE, 'YYYYMMDD');
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM orders
  WHERE order_number LIKE 'ORD-' || today || '-%';

  RETURN 'ORD-' || today || '-' || lpad(seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
```

### 마이그레이션 00032: 주문 표시 컬럼 설정

```sql
INSERT INTO settings (key, value) VALUES
  ('order_display_columns', '{"drug": ["ITEM_NAME", "BAR_CODE", "ENTP_NAME", "EDI_CODE"], "device": ["PRDLST_NM", "UDIDI_CD", "MNFT_IPRT_ENTP_NM", "CLSF_NO_GRAD_CD"]}')
ON CONFLICT (key) DO NOTHING;
```

- `drug`: 품목명, 바코드, 제조사, EDI코드
- `device`: 제품명, UDI코드, 제조/수입사, 등급

---

## 섹션 3: UI — 인라인 주문 생성 폼

### 레이아웃

주문 목록 테이블 상단에 인라인 폼이 펼쳐지는 구조:

1. **주문 헤더**: 주문번호(자동), 병원(Combobox), 주문일, 예상배송일, 실제배송일
2. **품목 검색**: `my_drugs` + `my_devices` 통합 검색, 드롭다운 선택
3. **선택된 품목 목록**: 설정된 4개 컬럼 + 수량 + 가격 (인라인 편집)
4. **메모**: 텍스트 입력
5. **액션**: 취소, 주문 생성

### 동작 흐름

1. "+ 주문 추가" 클릭 → 폼 펼침, 주문번호 자동생성
2. 병원 선택 → `hospitals` 테이블 Combobox 검색
3. 품목 검색 → `my_drugs` + `my_devices` 통합, 드롭다운 결과
4. 품목 선택 → 하단 목록 추가, `unit_price` 있으면 가격 자동
5. 수량/가격 인라인 편집
6. "주문 생성" → `orders` + `order_items` INSERT → 폼 접힘

### 컴포넌트 구조

```
OrderPage
├── OrderInlineForm (신규)
│   ├── OrderHeaderFields
│   ├── ItemSearchInput
│   ├── SelectedItemsTable (4개 컬럼 + 수량 + 가격)
│   └── FormActions
└── OrderTable (기존, 파싱 컬럼 제거)
```

### 주문번호 형식

`ORD-YYYYMMDD-NNN` (예: `ORD-20260227-001`)

---

## 섹션 4: UI — 컬럼 설정

### 설정 페이지 (`/settings`)

기존 설정 페이지에 "주문 표시 컬럼" 섹션 추가:

- 의약품: 체크박스로 4개 선택 (24개 컬럼 중)
- 의료기기: 체크박스로 4개 선택 (20개 컬럼 중)
- 4개 초과 선택 시 차단
- 저장 → `settings.order_display_columns` 업데이트

---

## 삭제/유지 정리

### 삭제 대상

| 대상 | 위치 |
|------|------|
| Edge Functions | `parse-message/`, `test-parse/` |
| DB 테이블 | `raw_messages` |
| DB 컬럼 | `orders.message_id`, `order_items.original_text`, `.match_status`, `.match_confidence` |
| DB 타입 | `match_status_enum` |
| 웹 페이지 | 메시지 관련 라우트 전체 |
| 네비게이션 | 메시지 메뉴 항목 |
| 서버 액션 | 메시지 파싱 관련 |
| 설정 UI | 파싱 전용 설정 |
| 컴포넌트 | 메시지 파싱 관련 |

### 유지 대상

| 대상 | 이유 |
|------|------|
| AI 연결 설정 (API 키, 모델 선택) | 향후 다른 기능 활용 |
| `settings` 테이블 구조 | 컬럼 설정 등 계속 사용 |
| `products` 테이블 | `order_items.product_id` FK 유지 |
