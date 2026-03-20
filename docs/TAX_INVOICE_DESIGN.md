# NotiFlow 주문 시스템 + 전자세금계산서 통합 설계안

> **작성일**: 2026-03-20
> **버전**: v1.0
> **상태**: 설계 단계 (미구현)
> **발행 구조**: 젠스코리아(공급자) → 투석 병원(공급받는자)
> **Phase 1 범위**: 국세청/ASP 연동 없이 로컬에서 생성·관리·PDF 출력 → 추후 연동 확장

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [현재 주문 시스템 분석](#2-현재-주문-시스템-분석)
3. [전자세금계산서 데이터 모델](#3-전자세금계산서-데이터-모델)
4. [시스템 아키텍처](#4-시스템-아키텍처)
5. [API 및 Server Actions 설계](#5-api-및-server-actions-설계)
6. [세금계산서 PDF 생성](#6-세금계산서-pdf-생성)
7. [대시보드 UI 설계](#7-대시보드-ui-설계)
8. [TypeScript 타입 정의](#8-typescript-타입-정의)
9. [보안: RLS 정책](#9-보안-rls-정책)
10. [자동화: Cron Jobs](#10-자동화-cron-jobs)
11. [구현 로드맵](#11-구현-로드맵)
12. [향후 확장 계획 (Phase 2)](#12-향후-확장-계획-phase-2)

---

## 1. 프로젝트 개요

### 1.1 배경 및 목적

NotiFlow는 투석 병원의 의료소모품 주문 관리 시스템으로, 현재 알림/SMS 기반 주문 캡처부터 주문 생성, 상태 관리, 배송 추적까지의 전체 프로세스를 관리하고 있다. 본 설계안은 기존 주문 시스템에 전자세금계산서 발행 기능을 통합하여, 주문 완료(delivered) 후 세금계산서를 자동 또는 수동으로 생성하고 관리할 수 있는 로컬 자체 시스템을 구축하는 것을 목적으로 한다.

### 1.2 기본 방향

- 주문이 `confirmed` 이상이 되면 세금계산서 초안을 생성할 수 있게 함
- 주문 시점과 세금계산서 발행 시점은 독립적 (예: 2월 주문 → 3월 발행)
- 여러 주문을 묶어 세금계산서 1건으로 합산 발행 가능 (N:M 관계)
- 법정 양식에 맞는 세금계산서 PDF를 자체 생성
- 발행 이력과 상태를 DB에서 관리
- 추후 ASP 연동 시 `asp-client.ts` 모듈만 추가하면 되도록 서비스 레이어 분리

### 1.3 발행 구조

- **발행자(공급자)**: 젠스코리아 (의료소모품 공급업체)
- **수신자(공급받는자)**: 투석 병원 (NotiFlow에 등록된 hospitals)
- **발행 시점**: 주문 배송 완료(delivered) 후 또는 월 단위 합산 발행
- **관리 범위**: 세금계산서 생성, PDF 출력, 이력 관리, 통계 대시보드

### 1.4 Phase 1 vs Phase 2 범위

| 구분 | Phase 1 (로컬 자체 구축) | Phase 2 (홈택스/ASP 연동 확장) |
|---|---|---|
| 세금계산서 생성 | NotiFlow 내부 자동/수동 생성 | 유지 |
| 고유번호 발급 | 자체 채번 규칙 (TI-YYYYMMDD-###) | 국세청 승인번호 연계 |
| PDF 출력 | 국세청 표준 양식 기반 PDF 생성 | 유지 + 국세청 직접 조회 |
| 전자서명 | 미포함 | 공인인증서 기반 전자서명 |
| 홈택스 전송 | 미포함 (수동 업로드 가이드 제공) | API 자동 전송 |
| 수정세금계산서 | 로컬 수정 발행 | 국세청 연동 수정 발행 |
| 매입/매출 조회 | 자체 DB 기반 | 홈택스 데이터 연동 |

---

## 2. 현재 주문 시스템 분석

### 2.1 핵심 테이블 구조

현재 NotiFlow의 주문 시스템은 다음 핵심 테이블로 구성되어 있다:

| 테이블 | 역할 | 주요 필드 |
|---|---|---|
| `orders` | 주문 헤더 | `order_number`, `hospital_id`, `status`, `total_amount`, `supply_amount`, `tax_amount` |
| `order_items` | 주문 품목 | `product_id`, `product_name`, `quantity`, `unit_price`, `line_total`, `supplier_id` |
| `hospitals` | 병원(거래처) | `name`, `business_number`, `address`, `contact_person`, `payment_terms` |
| `suppliers` | 공급업체 | `name`, `business_number`, `ceo_name`, `business_type`, `business_category` |
| `products` | 제품 마스터 | `name`, `category`, `unit_price`, `standard_code` |
| `kpis_reports` | KPIS 보고 | `report_status`, `reference_number` |

### 2.2 주문 상태 흐름

```
draft ──[confirm]──→ confirmed ──[process]──→ processing ──[deliver]──→ delivered
  │                                                                         │
  └────────────────────── [cancel] ──────────────────→ cancelled             │
                                                                            │
                                             ┌─── 세금계산서 발행 트리거 ───┘
                                             ↓
                                       세금계산서 초안 생성 가능
```

**상태 전이 규칙:**

1. `draft` → `confirmed`: `confirmOrder()` → `confirmed_at` 타임스탬프 기록
2. `confirmed` → `processing`: 수동 상태 변경
3. `processing` → `delivered`: `markDelivered()` → `delivered_at` 자동 기록
4. Any → `cancelled`: 수동 상태 변경

### 2.3 금액 체계

기존 `orders` 테이블에는 이미 세금계산서 발행에 필요한 금액 필드가 존재한다:

- `total_amount`: 합계금액 (공급가액 + 세액) — `DECIMAL(15,2)`
- `supply_amount`: 공급가액 — `DECIMAL(15,2)`
- `tax_amount`: 세액 (부가가치세 10%) — `DECIMAL(15,2)`
- `order_items.line_total`: 품목별 금액 — `DECIMAL(12,2)`

이 금액 체계는 전자세금계산서의 필수 항목과 직접 매핑되므로, 기존 데이터를 그대로 활용할 수 있다.

### 2.4 사업자 정보 현황

세금계산서 발행에 필요한 사업자 정보는 이미 `hospitals`와 `suppliers` 테이블에 부분적으로 존재한다:

| 필수 항목 | hospitals (공급받는자) | suppliers (공급자) | 보완 필요 |
|---|---|---|---|
| 사업자등록번호 | `business_number` ✓ | `business_number` ✓ | — |
| 상호(법인명) | `name` ✓ | `name` ✓ | — |
| 대표자명 | `contact_person` (△) | `ceo_name` ✓ | hospitals에 `ceo_name` 추가 |
| 사업장 주소 | `address` ✓ | `address` ✓ | — |
| 업태 | — (없음) | `business_type` ✓ | hospitals에 추가 |
| 종목 | — (없음) | `business_category` ✓ | hospitals에 추가 |
| 이메일 | — (없음) | — (없음) | 양쪽 모두 추가 |

### 2.5 주문과 세금계산서의 N:M 관계

주문 1건에 세금계산서 1건이 아니라, 다양한 케이스를 수용한다:

- 2월 주문 → 3월에 세금계산서 발행 (발행 연기)
- 2월 주문 3건을 묶어서 → 3월에 세금계산서 1건으로 합산 발행
- 1건 주문의 품목 일부만 먼저 세금계산서 발행, 나머지는 다음 달에

```
orders (주문)                    tax_invoices (세금계산서)
┌──────────┐                    ┌──────────────┐
│ 2월 주문A │──┐                │ 3월 세금계산서 │
│ 2월 주문B │──┼── N:M 매핑 ──→│ (issue_date:  │
│ 2월 주문C │──┘                │  2026-03-10)  │
└──────────┘                    └──────────────┘
                                       │
                                       ▼
                               tax_invoice_items
                               ┌───────────────┐
                               │ 주문A 품목1    │
                               │ 주문A 품목2    │
                               │ 주문B 품목1    │ ← 각 품목이 어느 주문에서 왔는지 추적
                               │ 주문C 품목1    │
                               └───────────────┘
```

---

## 3. 전자세금계산서 데이터 모델

### 3.1 ENUM 타입

```sql
CREATE TYPE tax_invoice_status AS ENUM (
  'draft',        -- 초안 (수정 가능)
  'issued',       -- 발행 완료 (로컬 확정)
  'sent',         -- 전송 완료 (이메일/팩스)
  'cancelled',    -- 취소
  'modified'      -- 수정 발행
);

CREATE TYPE tax_invoice_type AS ENUM (
  'normal',       -- 정발행 (공급자 → 공급받는자)
  'reverse'       -- 역발행
);

CREATE TYPE tax_invoice_tax_type AS ENUM (
  'tax',          -- 세금계산서 (과세)
  'zero_rate',    -- 영세율 세금계산서
  'exempt'        -- 면세계산서
);

CREATE TYPE modify_reason AS ENUM (
  'return',              -- 환입 (반품)
  'price_change',        -- 계약의 해제
  'quantity_change',     -- 공급가액 변동
  'duplicate',           -- 착오에 의한 이중발급
  'seller_info_change',  -- 공급자 사업자등록번호 착오
  'buyer_info_change',   -- 내국신용장 사후개설
  'other'                -- 기타
);
```

### 3.2 `tax_invoices` 메인 테이블

세금계산서의 핵심 정보를 저장하는 메인 테이블. 국세청 전자세금계산서 표준 양식의 필수 항목을 모두 포함한다.

```sql
CREATE TABLE tax_invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(24) NOT NULL UNIQUE,  -- 자체 채번: TI-YYYYMMDD-###
  invoice_type    tax_invoice_type DEFAULT 'normal',
  tax_type        tax_invoice_tax_type DEFAULT 'tax',

  -- 날짜 필드 (주문 시점과 독립)
  issue_date       DATE NOT NULL,            -- 작성(발행)일자: 사용자가 지정, 부가세 귀속 기준
  supply_date      DATE,                     -- 공급일자 (단건 거래)
  supply_date_from DATE,                     -- 공급기간 시작 (기간 거래)
  supply_date_to   DATE,                     -- 공급기간 종료 (기간 거래)

  -- 공급자 (젠스코리아) 정보 스냅샷
  supplier_id         INT REFERENCES suppliers(id),
  supplier_biz_no     VARCHAR(10) NOT NULL,
  supplier_name       VARCHAR(100) NOT NULL,
  supplier_ceo_name   VARCHAR(50),
  supplier_address    VARCHAR(200),
  supplier_biz_type   VARCHAR(50),      -- 업태
  supplier_biz_item   VARCHAR(50),      -- 종목
  supplier_email      VARCHAR(200),

  -- 공급받는자 (병원) 정보 스냅샷
  hospital_id         INT REFERENCES hospitals(id),
  buyer_biz_no        VARCHAR(10) NOT NULL,
  buyer_name          VARCHAR(100) NOT NULL,
  buyer_ceo_name      VARCHAR(50),
  buyer_address       VARCHAR(200),
  buyer_biz_type      VARCHAR(50),
  buyer_biz_item      VARCHAR(50),
  buyer_email         VARCHAR(200),

  -- 금액
  supply_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,   -- 공급가액 합계
  tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,   -- 세액 합계
  total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,   -- 합계금액

  -- 상태 관리
  status          tax_invoice_status DEFAULT 'draft',
  remarks         TEXT,                      -- 비고
  issued_at       TIMESTAMPTZ,               -- 시스템상 발행 확정 시각
  issued_by       UUID REFERENCES auth.users(id),
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    UUID REFERENCES auth.users(id),

  -- 수정 세금계산서 관련
  original_invoice_id INT REFERENCES tax_invoices(id), -- 수정세금계산서 원본
  modify_reason   modify_reason,                       -- 수정사유

  -- PDF 및 메타
  pdf_url         VARCHAR(500),              -- 생성된 PDF Storage 경로

  -- 추후 국세청 연동용 (현재는 NULL)
  nts_confirm_no  VARCHAR(50),              -- 국세청 승인번호
  asp_response    JSONB,                    -- ASP 응답 원본
  sent_to_nts_at  TIMESTAMPTZ,              -- 국세청 전송 일시

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_tax_invoices_status ON tax_invoices(status);
CREATE INDEX idx_tax_invoices_issue_date ON tax_invoices(issue_date);
CREATE INDEX idx_tax_invoices_hospital ON tax_invoices(hospital_id);
CREATE INDEX idx_tax_invoices_number ON tax_invoices(invoice_number);
```

### 3.3 `tax_invoice_orders` 매핑 테이블 (N:M)

하나의 세금계산서에 여러 주문을 합산할 수 있고, 하나의 주문이 여러 세금계산서에 분할될 수 있다.

```sql
CREATE TABLE tax_invoice_orders (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  order_id        INT NOT NULL REFERENCES orders(id),
  amount          DECIMAL(15,2),     -- 해당 주문에서 포함된 금액
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, order_id)
);
```

### 3.4 `tax_invoice_items` 품목 테이블

세금계산서의 품목 상세를 저장하며, 국세청 양식의 품목란(최대 4줄 + 별지)에 해당한다.

```sql
CREATE TABLE tax_invoice_items (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  order_id        INT REFERENCES orders(id),          -- 어느 주문의 품목인지
  order_item_id   INT REFERENCES order_items(id),      -- 원본 주문 품목
  item_seq        INT NOT NULL DEFAULT 1,              -- 품목 순번 (1~)
  item_date       DATE,                                -- 해당 품목의 거래일
  item_name       VARCHAR(200) NOT NULL,               -- 품명
  specification   VARCHAR(100),                        -- 규격
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  supply_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,    -- 공급가액
  tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,    -- 세액
  remark          VARCHAR(100),                        -- 품목 비고
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tax_invoice_items_invoice ON tax_invoice_items(invoice_id);
```

### 3.5 `company_settings` 공급자 기본 정보 테이블

젠스코리아의 기본 사업자 정보와 세금계산서 설정을 저장한다. 세금계산서 발행 시 자동으로 공급자 정보를 채운다.

```sql
CREATE TABLE company_settings (
  id              SERIAL PRIMARY KEY,
  biz_no          VARCHAR(10) NOT NULL,        -- 사업자등록번호
  company_name    VARCHAR(100) NOT NULL,       -- 상호
  ceo_name        VARCHAR(50),                 -- 대표자
  address         VARCHAR(200),                -- 사업장 주소
  biz_type        VARCHAR(50),                 -- 업태
  biz_item        VARCHAR(50),                 -- 종목
  email           VARCHAR(200),                -- 이메일
  -- 세금계산서 자동 발행 설정
  auto_issue_on_delivery  BOOLEAN DEFAULT false,  -- 배송완료 시 자동발행 여부
  default_tax_type        tax_invoice_tax_type DEFAULT 'tax',
  monthly_consolidation   BOOLEAN DEFAULT false,  -- 월합산 발행 여부
  consolidation_day       INT DEFAULT 25,         -- 월합산 마감일
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 기존 테이블 확장 마이그레이션

```sql
-- hospitals 테이블에 세금계산서 필수 정보 추가
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ceo_name VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS biz_type VARCHAR(50);     -- 업태
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS biz_item VARCHAR(50);     -- 종목
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS email VARCHAR(200);       -- 세금계산서 수신 이메일
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS fax VARCHAR(20);          -- 팩스번호

COMMENT ON COLUMN hospitals.ceo_name IS '대표자명 (세금계산서용)';
COMMENT ON COLUMN hospitals.biz_type IS '업태 (세금계산서용)';
COMMENT ON COLUMN hospitals.biz_item IS '종목 (세금계산서용)';
COMMENT ON COLUMN hospitals.email IS '세금계산서 수신 이메일';

-- 주문 테이블에 세금계산서 발행 상태 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_invoice_status VARCHAR(20) DEFAULT 'pending';
  -- 'pending':  미발행
  -- 'partial':  일부 품목만 발행
  -- 'issued':   전체 발행 완료
```

### 3.7 세금계산서 번호 채번 함수

```sql
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  today_str VARCHAR(8);
  seq_num INT;
  new_number VARCHAR(24);
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 13) AS INT)
  ), 0) + 1
  INTO seq_num
  FROM tax_invoices
  WHERE invoice_number LIKE 'TI-' || today_str || '-%';

  new_number := 'TI-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 시스템 아키텍처

### 4.1 전체 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                  NotiFlow Web Dashboard                  │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ 주문관리  │  │ 세금계산서    │  │ 세금계산서 대시보드 │ │
│  │  (기존)   │→│ 발행/관리     │→│ 통계/리포트        │ │
│  └──────────┘  └──────────────┘  └────────────────────┘ │
│       │              │                     │             │
│       ▼              ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         Server Actions / Service Layer              │ │
│  │  createFromOrder | issueInvoice | generatePDF       │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────┐
│                    Supabase Backend                      │
│                                                          │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │ tax_invoices  │  │ tax_invoice_    │  │ company_   │ │
│  │              │  │ items / orders  │  │ settings   │ │
│  └──────────────┘  └─────────────────┘  └────────────┘ │
│       ↕                    ↕                             │
│  ┌──────────┐  ┌─────────────┐                          │
│  │ orders   │  │ order_items │  (기존 테이블)            │
│  └──────────┘  └─────────────┘                          │
│                                                          │
│  ┌──────────────────────────────┐                       │
│  │   Edge Functions             │                       │
│  │   - generate-invoice-pdf     │                       │
│  │   - auto-invoice-on-delivery │                       │
│  │   - monthly-invoice-batch    │                       │
│  └──────────────────────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

### 4.2 주문 → 세금계산서 연동 흐름

```
주문 상태 변경: processing → delivered
         │
         ▼
  ┌──────────────────────┐
  │ DB Trigger 또는       │
  │ Supabase Realtime     │
  │ (on orders.status     │
  │  = 'delivered')       │
  └──────────┬───────────┘
             │
   ┌────────▼────────┐     ┌───────────────┐
   │ auto_issue =    │ No  │ 수동발행 대기  │
   │ true?           │────→│ (목록에 표시)  │
   └────────┬────────┘     └───────────────┘
            │ Yes
   ┌────────▼────────┐     ┌───────────────┐
   │ monthly_consol  │ Yes │ 월말 합산 대기 │
   │ = true?         │────→│ (batch queue)  │
   └────────┬────────┘     └───────────────┘
            │ No
   ┌────────▼──────────────────┐
   │ createFromOrder()         │
   │ 1. 발행번호 채번          │
   │ 2. 공급자/공급받는자 스냅샷│
   │ 3. 주문 품목 → 세금계산서 │
   │ 4. 금액 계산              │
   │ 5. PDF 생성               │
   │ 6. status = 'issued'      │
   └───────────────────────────┘
```

### 4.3 날짜 관련 법적 참고사항

전자세금계산서의 날짜 구분:

| 필드 | 설명 | 비고 |
|---|---|---|
| `issue_date` (작성일자) | 세금계산서 상의 공식 발행일 | 부가세 귀속 시기 결정 |
| `supply_date` (공급일자) | 실제 재화가 공급된 날짜 | 주문의 `delivery_date`에서 가져올 수 있음 |
| `issued_at` (발행 시각) | 시스템에서 발행 확정한 시각 | 자동 기록 |
| 전송기한 | 작성일자 속한 달의 다음달 10일 | 추후 국세청 연동 시 활용 |

**예시**: 2월 15일 공급 → 작성일자를 2월로 설정 → 실제 시스템 발행은 3월 5일 → 3월 10일까지 국세청 전송하면 적법

---

## 5. API 및 Server Actions 설계

### 5.1 백엔드 모듈 구조

```
apps/web/src/lib/tax-invoice/
├── types.ts                  # 세금계산서 타입 정의
├── tax-invoice-service.ts    # 핵심 비즈니스 로직
├── tax-invoice-validator.ts  # 필수값 검증
├── tax-invoice-pdf.ts        # PDF 생성 (법정 양식)
└── asp-client.ts             # ← 추후 연동 시 여기만 구현
```

### 5.2 서비스 레이어 인터페이스

```typescript
interface TaxInvoiceService {
  // 단일 주문에서 생성
  createFromOrder(orderId: number, issueDate: string): Promise<TaxInvoice>;

  // 여러 주문을 묶어서 생성 (합산 발행)
  createFromOrders(orderIds: number[], issueDate: string): Promise<TaxInvoice>;

  // 발행 전 검증 (같은 공급받는자인지, 날짜 유효성 등)
  validateBulkCreate(orderIds: number[]): Promise<ValidationResult>;

  // 미발행 주문 조회 (기간별)
  getUnissuedOrders(filters: {
    hospitalId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Order[]>;

  // 전송기한 임박 건 조회
  getApproachingDeadline(daysLeft?: number): Promise<TaxInvoice[]>;

  // 발행 (로컬 확정)
  issue(invoiceId: number): Promise<TaxInvoice>;

  // 취소
  cancel(invoiceId: number, reason: string): Promise<TaxInvoice>;

  // 수정 발행 (기존 건 취소 + 새 건 발행)
  modify(invoiceId: number, changes: Partial<TaxInvoice>): Promise<TaxInvoice>;

  // PDF 생성
  generatePdf(invoiceId: number): Promise<Buffer>;

  // 추후 연동용 인터페이스 (현재는 no-op)
  sendToNts(invoiceId: number): Promise<void>;
}
```

### 5.3 Server Actions 목록

| 함수명 | 설명 | 트리거 |
|---|---|---|
| `createInvoiceFromOrder(orderId, issueDate)` | 단건 주문 → 세금계산서 초안 생성 | 수동 / 자동(배송완료) |
| `createConsolidatedInvoice(hospitalId, orderIds, issueDate)` | 복수 주문 합산 세금계산서 생성 | 월말 배치 / 수동 |
| `issueInvoice(invoiceId)` | 세금계산서 발행 확정 (draft→issued) | 수동 |
| `cancelInvoice(invoiceId, reason)` | 세금계산서 취소 처리 | 수동 |
| `createModifiedInvoice(originalId, reason, items)` | 수정세금계산서 발행 | 수동 |
| `generateInvoicePDF(invoiceId)` | PDF 파일 생성 및 Storage 저장 | 발행 시 자동 |
| `getInvoices(params)` | 세금계산서 목록 조회 (페이지네이션/필터) | 대시보드 |
| `getInvoiceDetail(id)` | 세금계산서 상세 (품목 포함) | 상세 페이지 |
| `getInvoiceStats(dateRange)` | 발행 통계 (건수, 금액 합계 등) | 대시보드 |
| `getUnbilledOrders(hospitalId?)` | 미발행 주문 목록 조회 | 발행 화면 |

### 5.4 핵심 구현 코드: 세금계산서 생성

```typescript
// apps/web/src/lib/tax-invoice/tax-invoice-service.ts
'use server';

export async function createFromOrder(orderId: number, issueDate: string) {
  const supabase = await createClient();

  // 1. 주문 정보 조회
  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      hospitals!inner(*, ceo_name, biz_type, biz_item, email),
      order_items(*, products(name, standard_code))
    `)
    .eq('id', orderId)
    .in('status', ['confirmed', 'processing', 'delivered'])
    .single();

  if (!order) throw new Error('발행 가능한 주문을 찾을 수 없습니다.');

  // 2. 공급자 설정 조회
  const { data: company } = await supabase
    .from('company_settings')
    .select('*')
    .single();

  if (!company) throw new Error('공급자 정보가 설정되지 않았습니다.');

  // 3. 발행번호 채번
  const { data: invoiceNumber } = await supabase
    .rpc('generate_invoice_number');

  // 4. 세금계산서 생성
  const { data: invoice } = await supabase
    .from('tax_invoices')
    .insert({
      invoice_number: invoiceNumber,
      tax_type: company.default_tax_type || 'tax',
      status: 'draft',
      issue_date: issueDate,
      supply_date: order.delivery_date,
      // 공급자 스냅샷
      supplier_biz_no: company.biz_no,
      supplier_name: company.company_name,
      supplier_ceo_name: company.ceo_name,
      supplier_address: company.address,
      supplier_biz_type: company.biz_type,
      supplier_biz_item: company.biz_item,
      supplier_email: company.email,
      // 공급받는자 스냅샷
      hospital_id: order.hospital_id,
      buyer_biz_no: order.hospitals.business_number,
      buyer_name: order.hospitals.name,
      buyer_ceo_name: order.hospitals.ceo_name,
      buyer_address: order.hospitals.address,
      buyer_biz_type: order.hospitals.biz_type,
      buyer_biz_item: order.hospitals.biz_item,
      buyer_email: order.hospitals.email,
      // 금액
      supply_amount: order.supply_amount,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount,
    })
    .select()
    .single();

  // 5. 품목 생성
  const items = order.order_items.map((item, idx) => ({
    invoice_id: invoice.id,
    item_seq: idx + 1,
    order_id: orderId,
    order_item_id: item.id,
    item_date: order.delivery_date,
    item_name: item.product_name || item.products?.name || '품목',
    specification: item.products?.standard_code,
    quantity: item.quantity,
    unit_price: item.unit_price || 0,
    supply_amount: item.line_total || 0,
    tax_amount: Math.round((item.line_total || 0) * 0.1),
  }));

  await supabase.from('tax_invoice_items').insert(items);

  // 6. 주문-세금계산서 연결
  await supabase.from('tax_invoice_orders').insert({
    invoice_id: invoice.id,
    order_id: orderId,
    amount: order.total_amount,
  });

  return { invoiceId: invoice.id, invoiceNumber };
}
```

### 5.5 합산 세금계산서 생성

```typescript
export async function createFromOrders(
  orderIds: number[],
  issueDate: string
) {
  const supabase = await createClient();

  // 1. 선택된 주문들의 품목 전체 조회
  const { data: orders } = await supabase
    .from('orders')
    .select(`*, hospitals!inner(*), order_items(*, products(name, standard_code))`)
    .in('id', orderIds)
    .in('status', ['confirmed', 'processing', 'delivered']);

  // 2. 동일 병원 검증
  const hospitalIds = [...new Set(orders.map(o => o.hospital_id))];
  if (hospitalIds.length > 1) {
    throw new Error('합산 발행은 같은 공급받는자(병원)의 주문만 가능합니다.');
  }

  // 3. 금액 합산
  const totals = orders.reduce((acc, o) => ({
    supply: acc.supply + (o.supply_amount || 0),
    tax: acc.tax + (o.tax_amount || 0),
    total: acc.total + (o.total_amount || 0),
  }), { supply: 0, tax: 0, total: 0 });

  // 4. 공급기간 산출
  const dates = orders
    .map(o => o.delivery_date)
    .filter(Boolean)
    .sort();

  // 5. 세금계산서 생성 (supply_date_from/to 설정)
  // ... (createFromOrder와 유사, 합산 금액 및 공급기간 사용)

  // 6. 모든 주문의 품목을 하나의 세금계산서에 매핑
  // 7. tax_invoice_orders에 N건 매핑

  return { invoiceId, invoiceNumber };
}
```

### 5.6 검증 로직

```typescript
// tax-invoice-validator.ts

export function validateForIssue(invoice: TaxInvoice): ValidationResult {
  const errors: string[] = [];

  // 사업자번호 형식 (10자리, 체크디짓 검증)
  if (!isValidBizNo(invoice.supplier_biz_no)) {
    errors.push('공급자 사업자등록번호가 유효하지 않습니다.');
  }
  if (!isValidBizNo(invoice.buyer_biz_no)) {
    errors.push('공급받는자 사업자등록번호가 유효하지 않습니다.');
  }

  // 금액 정합성
  if (invoice.supply_amount + invoice.tax_amount !== invoice.total_amount) {
    errors.push('공급가액 + 세액 ≠ 합계금액');
  }

  // 필수 정보 존재 여부
  if (!invoice.supplier_name) errors.push('공급자 상호가 없습니다.');
  if (!invoice.buyer_name) errors.push('공급받는자 상호가 없습니다.');

  // 품목 1건 이상
  if (!invoice.items || invoice.items.length === 0) {
    errors.push('품목이 1건 이상 필요합니다.');
  }

  return { valid: errors.length === 0, errors };
}

// 사업자등록번호 체크디짓 검증
function isValidBizNo(bizNo: string): boolean {
  if (!bizNo || bizNo.length !== 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const digits = bizNo.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }
  sum += Math.floor((digits[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === digits[9];
}
```

### 5.7 API Routes

```
apps/web/src/app/api/tax-invoice/
├── route.ts                  # GET: 목록 조회 / POST: 초안 생성
├── [id]/route.ts             # GET: 상세 / PATCH: 수정 / DELETE: 삭제(draft만)
├── [id]/issue/route.ts       # POST: 발행 확정
├── [id]/cancel/route.ts      # POST: 취소
└── [id]/pdf/route.ts         # GET: PDF 다운로드
```

---

## 6. 세금계산서 PDF 생성

### 6.1 국세청 표준 양식 구조

| 영역 | 내용 | 데이터 소스 |
|---|---|---|
| 상단 헤더 | 전자세금계산서 제목, 작성일자, 공급자/공급받는자 구분 | `tax_invoices` |
| 공급자 정보 | 등록번호, 상호, 대표자, 사업장주소, 업태, 종목 | `tax_invoices.supplier_*` |
| 공급받는자 정보 | 등록번호, 상호, 대표자, 사업장주소, 업태, 종목 | `tax_invoices.buyer_*` |
| 금액 요약 | 공급가액, 세액, 합계금액 (현금/수표/어음/외상미수금) | `tax_invoices.*_amount` |
| 품목 명세 | 월/일, 품목, 규격, 수량, 단가, 공급가액, 세액, 비고 | `tax_invoice_items` |
| 하단 합계 | 합계금액 (한글+숫자), 인수 여부 | `tax_invoices.total_amount` |

### 6.2 PDF 양식 레이아웃

```
┌──────────────────────────────────────────┐
│            전 자 세 금 계 산 서            │
│         (공급자 보관용 / 공급받는자 보관용)   │
├──────────────┬───────────────────────────┤
│  공급자       │  공급받는자                 │
│  사업자번호   │  사업자번호                 │
│  상호/대표자  │  상호/대표자                │
│  주소        │  주소                      │
│  업태/종목    │  업태/종목                  │
├──────────────┴───────────────────────────┤
│  작성일자    공급가액    세액    합계금액     │
├────┬────┬────┬────┬──────┬──────┬────────┤
│월/일│품목 │규격 │수량 │단가    │공급가액 │세액  │
├────┼────┼────┼────┼──────┼──────┼────────┤
│    │    │    │    │      │      │        │
│ ...│    │    │    │      │      │        │
├────┴────┴────┴────┴──────┴──────┴────────┤
│  합계금액:  ₩ XXX,XXX                      │
│  비고:                                     │
└──────────────────────────────────────────┘
```

### 6.3 PDF 생성 기술 스택

두 가지 방식 중 선택 가능:

**방식 A: HTML → PDF (추천)**
- `puppeteer` 또는 `@vercel/og` 기반 HTML 템플릿 렌더링
- 국세청 양식을 HTML/CSS로 정밀 구현
- 한글 폰트(Noto Sans KR) 포함
- 장점: 디자인 유연성, 유지보수 편의

**방식 B: pdf-lib 직접 생성**
- `pdf-lib` 라이브러리로 좌표 기반 직접 렌더링
- 표준 양식의 격자/테이블을 프로그래매틱하게 그리기
- 장점: 외부 의존성 최소화, Edge Function 호환성

### 6.4 PDF 생성 Edge Function

```typescript
// packages/supabase/functions/generate-invoice-pdf/index.ts

import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  const { invoiceId } = await req.json();
  const supabase = createClient(/* ... */);

  // 1. 세금계산서 + 품목 조회
  const { data: invoice } = await supabase
    .from('tax_invoices')
    .select('*, tax_invoice_items(*)')
    .eq('id', invoiceId)
    .single();

  // 2. HTML 템플릿 렌더링
  const html = renderInvoiceHTML(invoice);

  // 3. PDF 변환
  const pdfBytes = await generatePDF(html);

  // 4. Supabase Storage에 업로드
  const path = `invoices/${invoice.invoice_number}.pdf`;
  await supabase.storage
    .from('documents')
    .upload(path, pdfBytes, { contentType: 'application/pdf' });

  // 5. pdf_url 업데이트
  await supabase
    .from('tax_invoices')
    .update({ pdf_url: path })
    .eq('id', invoiceId);

  return new Response(JSON.stringify({ path }));
});
```

---

## 7. 대시보드 UI 설계

### 7.1 신규 라우트 구조

```
apps/web/src/app/(dashboard)/
├── tax-invoices/                   -- 세금계산서 목록
│   ├── page.tsx                    -- 목록 (필터: 상태, 기간, 병원)
│   ├── [id]/
│   │   └── page.tsx                -- 상세 (미리보기, 수정, PDF 다운로드)
│   ├── new/
│   │   └── page.tsx                -- 수동 발행 (주문 선택 → 세금계산서 생성)
│   └── actions.ts                  -- 페이지 레벨 Server Actions
├── settings/
│   └── company/
│       └── page.tsx                -- 자사 정보 관리 (사업자번호, 상호 등)
```

### 7.2 세금계산서 생성 방식

**방법 A — 주문 상세에서 개별 발행**

```
주문 상세 → [세금계산서 발행] → 작성일자 지정 → 초안 생성 (해당 주문 1건)
```

**방법 B — 여러 주문을 묶어서 합산 발행**

```
주문 목록 → 체크박스로 여러 주문 선택
         → [선택 주문 세금계산서 발행]
         → 같은 병원(공급받는자) 주문만 묶을 수 있음
         → 작성일자를 사용자가 직접 지정
         → 품목 합산된 초안 생성
```

### 7.3 세금계산서 목록 페이지

| 영역 | 구성 요소 | 기능 |
|---|---|---|
| 상단 필터바 | 상태 탭 (전체/임시/발행/전송/취소), 기간 필터, 병원 검색 | 필터링 |
| 데이터 테이블 | 발행번호, 발행일, 거래처명, 공급가액, 세액, 합계, 상태 뱃지 | 정렬/페이지네이션 |
| 액션 버튼 | 신규 발행, 합산 발행, 선택 PDF 다운로드, 선택 삭제 | CRUD |
| 요약 카드 | 이번 달 발행 건수/금액, 미발행 주문 건수, 전월 대비 증감 | 통계 |

### 7.4 초안 생성 화면

```
┌─ 세금계산서 초안 ──────────────────────────┐
│                                            │
│  작성일자:  [2026-03-10]  ← 사용자 지정     │
│  공급일자:  [2026-02-15]  ← 주문 배송일 자동 │
│            또는                              │
│  공급기간:  [2026-02-01] ~ [2026-02-28]     │
│                                            │
│  연결된 주문:                                │
│    ☑ ORD-20260210-001 (2/10, ₩1,200,000)  │
│    ☑ ORD-20260218-003 (2/18, ₩800,000)    │
│    ☑ ORD-20260225-007 (2/25, ₩450,000)    │
│                                            │
│  공급가액:  ₩2,450,000                      │
│  세    액:  ₩245,000                        │
│  합    계:  ₩2,695,000                      │
│                                            │
│  [취소]              [미리보기]  [발행 확정]   │
└────────────────────────────────────────────┘
```

### 7.5 주문 목록에 발행 상태 표시

```
주문번호           | 병원      | 금액       | 상태      | 세금계산서
ORD-20260210-001  | OO병원    | ₩1,200,000 | delivered | ● 발행완료
ORD-20260218-003  | OO병원    | ₩800,000   | delivered | ○ 미발행
ORD-20260225-007  | △△의원   | ₩450,000   | confirmed | ◐ 일부발행
```

### 7.6 기존 페이지 수정

- **주문 상세 페이지**: `confirmed` 이상 주문에 "세금계산서 발행" 버튼 추가, 기발행 건 링크 표시
- **설정 페이지**: 자사 정보 관리 (사업자번호, 상호, 대표자, 업태, 종목, 주소)

### 7.7 대시보드 알림/경고

발행 시점이 자유로운 만큼 빠뜨리기 쉬우므로 대시보드에 경고 위젯 추가:

- **"미발행 주문 N건"**: `tax_invoice_status = 'pending'`이고 배송 완료된 주문
- **"전송기한 임박"**: `issue_date` 기준 익월 10일까지 N일 남은 건 (추후 연동 시 활용)
- **월말 리마인더**: "2월 공급분 세금계산서 미발행 건이 있습니다"

---

## 8. TypeScript 타입 정의

`apps/web/src/lib/tax-invoice/types.ts`에 정의:

```typescript
// ---- 전자세금계산서 관련 타입 ----

export type TaxInvoiceStatus = 'draft' | 'issued' | 'sent' | 'cancelled' | 'modified';
export type TaxInvoiceType = 'normal' | 'reverse';
export type TaxInvoiceTaxType = 'tax' | 'zero_rate' | 'exempt';
export type ModifyReason = 'return' | 'price_change' | 'quantity_change'
  | 'duplicate' | 'seller_info_change' | 'buyer_info_change' | 'other';

export interface TaxInvoice {
  id: number;
  invoice_number: string;
  invoice_type: TaxInvoiceType;
  tax_type: TaxInvoiceTaxType;
  status: TaxInvoiceStatus;
  issue_date: string;
  supply_date: string | null;
  supply_date_from: string | null;
  supply_date_to: string | null;

  // 공급자 스냅샷
  supplier_id: number | null;
  supplier_biz_no: string;
  supplier_name: string;
  supplier_ceo_name: string | null;
  supplier_address: string | null;
  supplier_biz_type: string | null;
  supplier_biz_item: string | null;
  supplier_email: string | null;

  // 공급받는자 스냅샷
  hospital_id: number | null;
  buyer_biz_no: string;
  buyer_name: string;
  buyer_ceo_name: string | null;
  buyer_address: string | null;
  buyer_biz_type: string | null;
  buyer_biz_item: string | null;
  buyer_email: string | null;

  // 금액
  supply_amount: number;
  tax_amount: number;
  total_amount: number;

  // 수정 관련
  original_invoice_id: number | null;
  modify_reason: ModifyReason | null;
  remarks: string | null;

  // 메타
  pdf_url: string | null;
  issued_at: string | null;
  issued_by: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface TaxInvoiceItem {
  id: number;
  invoice_id: number;
  item_seq: number;
  order_id: number | null;
  order_item_id: number | null;
  item_date: string | null;
  item_name: string;
  specification: string | null;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
  remark: string | null;
}

export interface TaxInvoiceDetail extends TaxInvoice {
  items: TaxInvoiceItem[];
  linked_orders: {
    order_id: number;
    order_number: string;
    amount: number;
  }[];
}

export interface TaxInvoiceStats {
  total_count: number;
  issued_count: number;
  total_supply_amount: number;
  total_tax_amount: number;
  total_amount: number;
  unbilled_order_count: number;
}

export interface TaxInvoiceDates {
  issue_date: string;           // 작성일자 (사용자 지정, 세금 귀속 기준)
  supply_date?: string;         // 공급일자 (단건 거래)
  supply_date_from?: string;    // 공급기간 시작 (기간 거래)
  supply_date_to?: string;      // 공급기간 종료 (기간 거래)
  issued_at?: string;           // 시스템상 발행 확정 시각 (자동 기록)
  nts_deadline?: string;        // 국세청 전송 기한 (자동 계산: issue_date 익월 10일)
}

export interface CompanySettings {
  id: number;
  biz_no: string;
  company_name: string;
  ceo_name: string | null;
  address: string | null;
  biz_type: string | null;
  biz_item: string | null;
  email: string | null;
  auto_issue_on_delivery: boolean;
  default_tax_type: TaxInvoiceTaxType;
  monthly_consolidation: boolean;
  consolidation_day: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

## 9. 보안: RLS 정책

NotiFlow의 기존 보안 모델을 따라, 세금계산서 관련 테이블에도 Row Level Security를 적용한다:

```sql
-- tax_invoices RLS
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "인증된 사용자 조회" ON tax_invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "인증된 사용자 생성" ON tax_invoices
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정" ON tax_invoices
  FOR UPDATE TO authenticated USING (true);

-- tax_invoice_items RLS
ALTER TABLE tax_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "인증된 사용자 조회" ON tax_invoice_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "인증된 사용자 생성" ON tax_invoice_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정" ON tax_invoice_items
  FOR UPDATE TO authenticated USING (true);

-- tax_invoice_orders RLS
ALTER TABLE tax_invoice_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "인증된 사용자 전체" ON tax_invoice_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- company_settings RLS (관리자만 수정 가능)
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "인증된 사용자 조회" ON company_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "서비스 역할만 수정" ON company_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 10. 자동화: Cron Jobs

### 10.1 기존 Cron 체계에 통합

NotiFlow의 기존 Vercel Cron 체계(`vercel.json`)에 세금계산서 관련 작업을 추가한다:

| 작업 | 스케줄 | API 경로 | 설명 |
|---|---|---|---|
| 월합산 발행 | 매월 25일 09:00 KST | `/api/cron/invoice-consolidation` | 미발행 주문을 병원별로 합산 발행 |
| 미발행 알림 | 매주 월요일 09:00 KST | `/api/cron/invoice-reminder` | 미발행 주문 목록 알림 (대시보드 + 이메일) |
| 월별 통계 생성 | 매월 1일 10:00 KST | `/api/cron/invoice-monthly-stats` | 전월 세금계산서 통계 집계 |

### 10.2 월합산 배치 처리 로직

```typescript
// apps/web/src/app/api/cron/invoice-consolidation/route.ts

export async function GET(request: Request) {
  // CRON_SECRET 검증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. 월합산 설정 확인
  const { data: company } = await supabase
    .from('company_settings')
    .select('monthly_consolidation')
    .single();

  if (!company?.monthly_consolidation) {
    return Response.json({ message: '월합산 비활성화' });
  }

  // 2. 미발행 delivered 주문을 병원별 그룹핑
  const { data: unbilledOrders } = await supabase
    .from('orders')
    .select('id, hospital_id')
    .eq('status', 'delivered')
    .eq('tax_invoice_status', 'pending');

  // 3. 병원별로 합산 세금계산서 생성
  const grouped = groupBy(unbilledOrders, 'hospital_id');
  const results = [];

  for (const [hospitalId, orders] of Object.entries(grouped)) {
    const result = await createFromOrders(
      orders.map(o => o.id),
      new Date().toISOString().split('T')[0]
    );
    results.push(result);
  }

  return Response.json({ created: results.length, invoices: results });
}
```

---

## 11. 구현 로드맵

### 11.1 마이그레이션 실행 순서

기존 마이그레이션 번호 체계(00001~00049)에 이어서 순차적으로 적용한다:

| 순번 | 파일명 | 내용 |
|---|---|---|
| 1 | `00050_hospitals_invoice_fields.sql` | hospitals 테이블에 세금계산서용 필드 추가 |
| 2 | `00051_orders_tax_invoice_status.sql` | orders 테이블에 `tax_invoice_status` 추가 |
| 3 | `00052_tax_invoice_enums.sql` | ENUM 타입 생성 |
| 4 | `00053_company_settings.sql` | `company_settings` 테이블 생성 |
| 5 | `00054_tax_invoices.sql` | `tax_invoices` 메인 테이블 + 인덱스 |
| 6 | `00055_tax_invoice_items.sql` | `tax_invoice_items` 테이블 + 인덱스 |
| 7 | `00056_tax_invoice_orders.sql` | `tax_invoice_orders` 매핑 테이블 |
| 8 | `00057_tax_invoice_rpc.sql` | `generate_invoice_number()` RPC 함수 |
| 9 | `00058_tax_invoice_rls.sql` | RLS 정책 설정 |
| 10 | `00059_tax_invoice_triggers.sql` | `updated_at` 트리거, 금액 자동 계산 트리거 |

### 11.2 개발 일정 (권장)

| 단계 | 기간 | 작업 내용 | 산출물 |
|---|---|---|---|
| Phase 1-1 | 1주차 | DB 마이그레이션, 타입 정의, 기본 CRUD | 테이블, 타입, Server Actions |
| Phase 1-2 | 2주차 | 세금계산서 목록/상세 UI, 수동 발행 플로 | 대시보드 페이지 |
| Phase 1-3 | 3주차 | PDF 생성, 합산 발행, 수정세금계산서 | PDF 템플릿, Edge Function |
| Phase 1-4 | 4주차 | 자동 발행, Cron Jobs, 통계 대시보드 | 자동화 파이프라인 |
| Phase 1-5 | 5주차 | 테스트, 버그 수정, 문서화 | QA 완료 |

### 11.3 구현 우선순위

| 순서 | 항목 | 설명 |
|---|---|---|
| 1 | DB 마이그레이션 | `company_settings`, `tax_invoices`, `tax_invoice_items`, `tax_invoice_orders` + `hospitals`/`orders` 컬럼 추가 |
| 2 | 설정 페이지 | 자사 사업자 정보 입력 UI |
| 3 | 서비스 레이어 | 주문→세금계산서 변환, 검증, 상태 관리 |
| 4 | PDF 생성 | 법정 양식 PDF 출력 |
| 5 | 세금계산서 목록/상세 UI | 관리 화면 |
| 6 | 주문 상세 연동 | 발행 버튼 + 연결 표시 |
| 7 | 합산 발행 | 주문 목록에서 복수 선택 → 합산 세금계산서 생성 |
| 8 | 대시보드 알림 | 미발행 경고, 기한 임박 알림 |

---

## 12. 향후 확장 계획 (Phase 2)

### 12.1 국세청/ASP 연동

Phase 2에서는 국세청 전자세금계산서 API(e-Tax) 또는 ASP(팝빌 등)와 연동하여 법적 효력이 있는 전자세금계산서를 발행한다:

- 공인인증서(또는 보안 인증서) 기반 전자서명 모듈
- 국세청 API 게이트웨이 연동 (REST/SOAP) 또는 ASP API 호출
- 국세청 승인번호 수신 및 저장
- 전송 실패 시 재전송 로직 (최대 3회 재시도)
- 매입 세금계산서 자동 조회 연동

### 12.2 확장을 위한 예약 필드

Phase 1의 `tax_invoices` 테이블에 이미 다음 필드를 예약해 두었다:

```sql
-- 현재 NULL, Phase 2에서 활용 시작
nts_confirm_no  VARCHAR(50),    -- 국세청 승인번호
asp_response    JSONB,          -- ASP 응답 원본
sent_to_nts_at  TIMESTAMPTZ,    -- 국세청 전송 일시
```

### 12.3 연동 시 변경 범위

| 영역 | 변경 내용 |
|---|---|
| `asp-client.ts` | ASP API 호출 로직 구현 (신규) |
| `tax-invoice-service.ts` | `sendToNts()` 메서드에 실제 전송 로직 연결 |
| `tax_invoices` 테이블 | 기존 `nts_confirm_no`, `asp_response`, `sent_to_nts_at` 컬럼 활용 시작 |
| `tax_invoice_status` enum | `sent_to_nts`, `nts_confirmed` 상태 추가 |
| API Routes | webhook 엔드포인트 추가 (ASP 콜백 수신) |
| 환경변수 | ASP 인증 키 추가 |
| Cron | 전송 결과 조회 배치 추가 |

### 12.4 환경 변수 (Phase 2)

```env
# ASP 연동 (예: 팝빌 기준)
POPBILL_LINK_ID=         # ASP 링크 아이디
POPBILL_SECRET_KEY=      # ASP 비밀 키
POPBILL_IS_TEST=true     # 테스트 모드 여부
POPBILL_CORP_NUM=        # 자사 사업자번호
```

### 12.5 연동 아키텍처 (Phase 2 예상)

```
NotiFlow ──[발행]──→ tax_invoices DB ──[전자서명]──→ 국세청 e-Tax API
                                                          │
                                                          ▼
                                                    승인번호 수신
                                                          │
                                                          ▼
                                              nts_confirm_no 저장
                                                          │
                                                          ▼
                                              병원 이메일/팩스 자동 전송
```
