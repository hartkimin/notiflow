# NotiFlow + NocoDB v3.1 도메인 특화 고도화 설계서

> **기반 문서:** notiflow_nocodb_dev_plan_v3.md
> **작성일:** 2026-02-13
> **목적:** 발주서_v2.2 실데이터 분석 결과를 반영하여 v3.0 계획을 고도화

---

## 1. 고도화 배경

v3.0 계획서는 일반적인 의료기기/의약품 유통을 가정했으나, 발주서_v2.2.xlsx 실데이터 분석 결과 다음 도메인 특화 요소가 발견됨:

### 1.1 실데이터 분석 결과

| 항목 | 규모 |
|------|------|
| 병원/거래처 | 41개 (병원, 의원, 약품사, 유통사 등 6개 유형) |
| 품목 마스터 | 628개 (다이알라이저, 혈액라인, AVF니들, 투석액, 의약품 등) |
| 별칭 매핑 | 1,033건 (통합_raw 시트) |
| 주문 이력 | 2년간 (2020.12 ~ 2022.11) |
| 공급사 | 보령, 알보젠, 니프로, CS, 성도, JMS 등 다수 |
| 카카오톡 별칭 | 극단적 약어 ("b", "G", "15", "니들", "EK13") |

### 1.2 핵심 발견

1. **병원별 별칭**: 같은 별칭("b")이 병원마다 다른 품목을 의미할 수 있음
2. **발신자 식별**: 전화번호가 아닌 카카오톡 앱명+발신자명으로 병원 식별
3. **공급사/매입처**: 품목별 매입처가 다르며, 발주 시 공급사 정보 필수
4. **KPIS 신고**: 의료기기 판매 후 KPIS(의료기기 유통추적) 신고 추적 필요
5. **배송 관리**: 주문일과 배송일이 별도이며, 달력 기반 배송 스케줄링 존재
6. **매출보고**: 발주처별/매출처별 세금계산서 관련 보고 기능 필요
7. **가격 구조**: 공급가액 + 부가세 = 합계 구조

---

## 2. DB 스키마 변경사항

### 2.1 hospitals 테이블 확장

기존 v3.0 스키마에 추가:

```sql
ALTER TABLE hospitals ADD COLUMN hospital_type VARCHAR(50) DEFAULT 'clinic';
  -- 유형: hospital, clinic, pharmacy, distributor, research, other
ALTER TABLE hospitals ADD COLUMN business_number VARCHAR(20);
  -- 사업자등록번호 (매출보고용)
ALTER TABLE hospitals ADD COLUMN payment_terms VARCHAR(100);
  -- 결제조건
ALTER TABLE hospitals ADD COLUMN trade_start_date DATE;
  -- 거래시작일
ALTER TABLE hospitals ADD COLUMN kakao_sender_names JSON DEFAULT '[]';
  -- 카카오톡 발신자명 목록 (앱명+발신자명 매칭용)
  -- 예: ["이한규내과", "이한규내과의원", "이한규 원장"]
```

### 2.2 products 테이블 확장

```sql
ALTER TABLE products ADD COLUMN official_name VARCHAR(500);
  -- 실제 의약품/의료용품 정식명 (발주서 B컬럼)
ALTER TABLE products ADD COLUMN short_name VARCHAR(255);
  -- 품목 약칭 (발주서 C컬럼, 실무에서 쓰는 이름)
ALTER TABLE products ADD COLUMN ingredient VARCHAR(500);
  -- 성분명 (영문)
ALTER TABLE products ADD COLUMN efficacy TEXT;
  -- 효능/효과 설명
```

category 값 세분화:
- `dialyzer` (다이알라이저/인공신장)
- `blood_line` (혈액라인세트)
- `avf_needle` (AVF 천자침)
- `dialysis_solution` (투석액)
- `filter` (필터)
- `medication` (의약품)
- `consumable` (소모품)
- `equipment` (장비)

### 2.3 product_aliases 테이블 확장 (병원별 별칭)

```sql
ALTER TABLE product_aliases ADD COLUMN hospital_id INT REFERENCES hospitals(id);
  -- NULL이면 글로벌 별칭, 값이 있으면 해당 병원 전용 별칭

-- UNIQUE 제약조건 변경
ALTER TABLE product_aliases
  ADD CONSTRAINT uq_hospital_alias UNIQUE (hospital_id, alias_normalized);
```

매칭 우선순위:
1. `hospital_id = 발신_병원_id AND alias_normalized = ?` (병원별 정확)
2. `hospital_id IS NULL AND alias_normalized = ?` (글로벌 정확)
3. LIKE 포함 매칭
4. Fuzzy 매칭
5. LLM 보조 매칭

### 2.4 신규: suppliers 테이블

```sql
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),
  contact_info JSON,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

초기 데이터: 보령, 알보젠, 니프로(Nipro), CS, 성도, MS, JMS, 프레제니우스(FMC), 도레이(Toray), 백스터(Baxter), 젠스코리아 등

### 2.5 신규: product_suppliers 테이블

```sql
CREATE TABLE product_suppliers (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  supplier_id INT NOT NULL REFERENCES suppliers(id),
  purchase_price DECIMAL(12,2),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);
```

### 2.6 orders 테이블 확장

```sql
ALTER TABLE orders ADD COLUMN delivery_date DATE;
  -- 배송 예정일
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP;
  -- 실제 배송 시각
ALTER TABLE orders ADD COLUMN supply_amount DECIMAL(15,2);
  -- 공급가액
ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(15,2);
  -- 부가세
```

### 2.7 order_items 확장

```sql
ALTER TABLE order_items ADD COLUMN supplier_id INT REFERENCES suppliers(id);
  -- 해당 항목의 매입처
ALTER TABLE order_items ADD COLUMN purchase_price DECIMAL(12,2);
  -- 매입 단가
```

### 2.8 신규: kpis_reports 테이블

```sql
CREATE TABLE kpis_reports (
  id SERIAL PRIMARY KEY,
  order_item_id INT NOT NULL REFERENCES order_items(id),
  report_status VARCHAR(20) DEFAULT 'pending',
    -- pending, reported, confirmed
  reported_at TIMESTAMP,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.9 신규: sales_reports 테이블

```sql
CREATE TABLE sales_reports (
  id SERIAL PRIMARY KEY,
  report_period VARCHAR(20) NOT NULL,
    -- 'YYYY-MM' 형식
  order_id INT REFERENCES orders(id),
  supplier_name VARCHAR(255),
    -- 발주처명
  hospital_name VARCHAR(255),
    -- 매출처명
  product_name VARCHAR(500),
  quantity INT,
  quantity_unit VARCHAR(20) DEFAULT 'box',
  standard_code VARCHAR(100),
  hospital_address TEXT,
  business_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. 병원 식별 방식 변경

### 3.1 기존 (v3.0)

```
발신자 전화번호 → hospitals.contact_phones → 병원 식별
```

### 3.2 변경 (v3.1)

```
1차: source_app(kakaotalk) + sender(발신자명)
     → hospitals.kakao_sender_names 정확 매칭
     → Redis 캐시 활용

2차: source_app(sms) + sender(전화번호)
     → hospitals.contact_phones 매칭

3차: Fuzzy 매칭 (발신자명 유사도)
     → 신뢰도 0.8+ 일 때 자동 매칭

4차: 매칭 실패
     → 텔레그램 알림 발송
     → NocoDB에서 수동 매핑
     → 매핑 결과 자동 학습 (kakao_sender_names 업데이트)
```

### 3.3 hospitalResolver.js 변경

- `resolveByPhone()` → `resolveByKakao(appName, senderName)` 추가
- `resolve()` 메서드에서 source_app에 따라 분기
- Redis 캐시 키: `hospital:kakao:{normalized_sender_name}`

---

## 4. 별칭 매칭 엔진 고도화

### 4.1 병원별 별칭 매칭 전략

```
입력: hospital_id=38(이한규내과), alias="b"

1. 병원별 정확 매칭
   SELECT product_id FROM product_aliases
   WHERE hospital_id = 38 AND alias_normalized = 'b'
   → 헤모시스비액 12.6L (confidence: 1.0)

2. 글로벌 정확 매칭 (1번 실패 시)
   SELECT product_id FROM product_aliases
   WHERE hospital_id IS NULL AND alias_normalized = 'b'
   → (없음)

3. 포함 매칭 / Fuzzy 매칭 / LLM 보조
```

### 4.2 별칭 자동 학습

NocoDB에서 수동 매칭 시:
1. order_items.product_id 수동 지정
2. Webhook 트리거 → API Gateway
3. `product_aliases` INSERT: hospital_id + alias + product_id
4. source = 'learned'
5. Redis 캐시 갱신

### 4.3 LLM 프롬프트 개선

병원별 최근 주문 품목 + 해당 병원의 등록된 별칭 목록을 프롬프트에 포함:

```
## 이 병원의 등록된 별칭
- "b" → 헤모시스비액 12.6L
- "G" → 헤모시스에이지액 10L
- "15" → XEVONTA DIALYZER HI 15
- "니들" → AVF NEEDLE 16G
- "라인" → BAIN TUBING SETS FOR HD
- "EK13" → 혈액투석여과기 EK-13H
```

---

## 5. Excel 데이터 임포트 시스템

### 5.1 임포트 순서

```
Step 1: suppliers     ← 월별 시트에서 고유 매입처 추출
Step 2: hospitals     ← 01_병원목록_신규 포함 시트
Step 3: products      ← 02_품목_New 시트 (628개)
Step 4: product_suppliers ← 월별 시트에서 품목-공급사 관계 추출
Step 5: product_aliases (글로벌) ← 통합_raw 시트 (1,033건)
Step 6: product_aliases (병원별) ← 이한규내과 데이타.xlsx
Step 7: product_box_specs ← 품목 데이터에서 박스 규격 추출
Step 8: historical_orders (선택) ← 월별 시트들
```

### 5.2 스크립트 구조

```
scripts/
├── import-excel.js           # 메인 임포트 오케스트레이터
├── parsers/
│   ├── supplierParser.js     # 매입처 고유값 추출
│   ├── hospitalParser.js     # 01_병원목록 시트 → hospitals
│   ├── productParser.js      # 02_품목_New 시트 → products
│   ├── aliasParser.js        # 통합_raw → product_aliases
│   ├── kakaoAliasParser.js   # 이한규내과 데이타 → 병원별 별칭
│   ├── boxSpecParser.js      # 박스 규격 추출
│   └── historyParser.js      # 월별 주문 이력
└── data/
    ├── 발주서_v2.2.xlsx
    └── 이한규내과 데이타.xlsx
```

### 5.3 데이터 정규화 규칙

- 품목 매칭: 02_품목_New의 B컬럼(정식명)을 `products.official_name`, C컬럼을 `products.short_name`
- 별칭 정규화: 공백 제거, 소문자 변환, 특수문자 제거
- 통합_raw의 D컬럼(실제_제품명) → products.official_name으로 매칭하여 product_id 연결
- 월별 시트의 컬럼 구조 차이 처리 (1~9월: 날짜/병원/품목/수량, 12월+: 날짜/배송일/병원/품목/수량)

---

## 6. 추가 기능 모듈

### 6.1 공급사 관리

**NocoDB 뷰:**
- 공급사 목록 (Grid)
- 품목별 공급사 (Grid, 그룹: product)
- 공급사별 품목 (Grid, 그룹: supplier)

**API 연동:**
- 주문 생성 시 `product_suppliers.is_primary`로 자동 매입처 지정
- `order_items.supplier_id` 자동 설정

### 6.2 KPIS 신고 추적

**NocoDB 뷰:**
- 미신고 항목 (필터: report_status=pending)
- 신고완료 (필터: report_status=reported)
- 기간별 신고 현황 (그룹: 월별)

**알림:**
- 주문 확정 후 7일 이내 미신고 → 텔레그램 리마인더

### 6.3 배송 관리

**NocoDB 뷰:**
- 배송 캘린더 (Calendar View, delivery_date 기준)
- 오늘 배송 (필터: delivery_date=today)
- 배송 대기 (필터: status=confirmed, delivery_date IS NOT NULL)

**자동화:**
- 주문 확정 시 delivery_date 자동 설정 (주문일 + 병원별 리드타임)
- 배송 완료 시 상태 자동 업데이트

### 6.4 매출보고서 생성

**API:**
- `GET /api/v1/reports/sales?period=2026-01` → 월별 매출보고 데이터
- `GET /api/v1/reports/sales/export?period=2026-01&format=csv` → CSV 내보내기

**자동 집계:**
- 확정된 주문 기반 → 발주처/매출처/제품/수량/표준코드/주소/사업자번호 자동 매칭

---

## 7. 수정된 NocoDB 뷰 목록

기존 v3.0 뷰에 추가:

### 7.1 공급사 관리 (신규)

| 뷰 이름 | 유형 | 설명 |
|---------|------|------|
| 전체 공급사 | Grid | 공급사 목록 |
| 품목별 공급사 | Grid (product_suppliers) | 품목-공급사 관계 |

### 7.2 KPIS 관리 (신규)

| 뷰 이름 | 유형 | 설명 |
|---------|------|------|
| 미신고 항목 | Grid (필터: pending) | 신고 필요 항목 |
| 신고 완료 | Grid (필터: reported) | 완료된 신고 |

### 7.3 배송 관리 (신규)

| 뷰 이름 | 유형 | 설명 |
|---------|------|------|
| 배송 캘린더 | Calendar (delivery_date) | 달력 형태 배송 조회 |
| 오늘 배송 | Grid (필터: today) | 당일 배송 목록 |

### 7.4 매출보고 (신규)

| 뷰 이름 | 유형 | 설명 |
|---------|------|------|
| 월별 매출 | Grid (그룹: report_period) | 월별 매출 현황 |

---

## 8. 수정된 Phase 구성

### Phase 1: 인프라 구축 + 데이터 임포트 (1주)

기존 1-1~1-8 유지 + 추가:

| # | 작업 | 변경 유형 |
|---|------|----------|
| 1-2 | init-db.sql에 suppliers, product_suppliers, kpis_reports, sales_reports 추가 | 확장 |
| 1-7 | seed-data.sql → import-excel.js로 대체 (628품목+41병원+1033별칭 자동 임포트) | 변경 |
| 1-9 | Excel 임포트 스크립트 개발 | 신규 |
| 1-10 | 임포트 데이터 검증 (NocoDB 뷰에서 확인) | 신규 |

### Phase 2: API Gateway 핵심 개발 (2주)

기존 2-1~2-13 유지 + 변경:

| # | 작업 | 변경 유형 |
|---|------|----------|
| 2-6 | hospitalResolver.js: 전화번호 → 앱명+발신자명 매칭으로 변경 | 변경 |
| 2-10 | productMatcher.js: 병원별 별칭 매칭 추가 | 확장 |
| 2-14 | 공급사 자동 연결 로직 (주문 생성 시) | 신규 |

### Phase 3: 고급 기능 (1.5주)

기존 3-1~3-8 유지 + 추가:

| # | 작업 | 변경 유형 |
|---|------|----------|
| 3-9 | KPIS 신고 추적 모듈 | 신규 |
| 3-10 | 배송 관리 (delivery_date, Calendar View) | 신규 |
| 3-11 | 공급사 관련 NocoDB 뷰 설정 | 신규 |

### Phase 4: NotiFlow 연동 전환 (1주)

기존 4-1~4-6 유지

### Phase 5: 운영 안정화 + 매출보고 (1.5주)

기존 5-1~5-6 유지 + 추가:

| # | 작업 | 변경 유형 |
|---|------|----------|
| 5-7 | 매출보고서 생성 API | 신규 |
| 5-8 | 매출보고 CSV/Excel 내보내기 | 신규 |
| 5-9 | 실데이터 기반 AI 프롬프트 튜닝 (628품목 카탈로그 활용) | 확장 |

### 전체 일정

```
Phase 1  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  1주    인프라 + 데이터 임포트
Phase 2  ░░░░████████████░░░░░░░░░░░░░░░░░  2주    API Gateway 핵심
Phase 3  ░░░░░░░░░░░░░░░░██████░░░░░░░░░░░  1.5주  고급 기능 + KPIS/배송
Phase 4  ░░░░░░░░░░░░░░░░░░░░░░████░░░░░░░  1주    NotiFlow 연동
Phase 5  ░░░░░░░░░░░░░░░░░░░░░░░░░░██████░  1.5주  안정화 + 매출보고

총 예상: 약 8주 (기존 6주 + 2주)
```

---

## 9. 수정된 프로젝트 구조

기존 v3.0 구조에 추가/변경:

```
notiflow-order-system/
├── ...기존 구조 유지...
│
├── api-gateway/src/
│   ├── services/
│   │   ├── hospitalResolver.js   # 변경: 앱명+발신자명 매칭 추가
│   │   ├── productMatcher.js     # 변경: 병원별 별칭 매칭 추가
│   │   ├── supplierService.js    # 신규: 공급사 관리
│   │   ├── kpisService.js        # 신규: KPIS 신고 추적
│   │   ├── deliveryService.js    # 신규: 배송 관리
│   │   └── salesReportService.js # 신규: 매출보고서 생성
│   └── routes/
│       ├── reports.js            # 신규: 매출보고/KPIS API
│       └── delivery.js           # 신규: 배송 관리 API
│
├── scripts/
│   ├── import-excel.js           # 신규: Excel 데이터 임포트
│   ├── parsers/                  # 신규: 시트별 파서
│   │   ├── supplierParser.js
│   │   ├── hospitalParser.js
│   │   ├── productParser.js
│   │   ├── aliasParser.js
│   │   ├── kakaoAliasParser.js
│   │   ├── boxSpecParser.js
│   │   └── historyParser.js
│   └── data/                     # 신규: 임포트 소스 데이터
│       ├── 발주서_v2.2.xlsx
│       └── 이한규내과 데이타.xlsx
```

---

## 10. v3.0 → v3.1 변경 이력 요약

| 영역 | v3.0 | v3.1 | 변경 사유 |
|------|------|------|----------|
| 도메인 | 일반 의료기기 | **혈액투석 전문 유통** | 발주서 실데이터 분석 |
| 병원 식별 | 전화번호 매칭 | **앱명+발신자명 매칭** | NotiFlow 실제 전송 형식 |
| 별칭 범위 | 글로벌 | **병원별 별칭** | 같은 약어가 병원마다 다른 의미 |
| 품목 데이터 | 수동 등록 | **628개 자동 임포트** | 발주서 02_품목_New 시트 |
| 별칭 데이터 | 수동 등록 | **1,033건 자동 임포트** | 발주서 통합_raw 시트 |
| 공급사 | 미관리 | **suppliers 테이블 + 자동 연결** | 매입처 정보 필수 |
| KPIS | 미관리 | **kpis_reports 테이블** | 의료기기 유통추적 신고 의무 |
| 배송 | 미관리 | **delivery_date + Calendar View** | 배송 스케줄 관리 필요 |
| 매출보고 | 미관리 | **sales_reports + CSV 내보내기** | 월별 매출보고 업무 |
| 가격 구조 | 단가 | **공급가+부가세+합계** | 세금계산서 구조 반영 |
| 시드 데이터 | 샘플 데이터 | **Excel 전체 임포트** | 즉시 실전 투입 가능 |
| 개발 기간 | 6주 | **8주** (+2주) | 추가 기능/임포트 반영 |

---

*문서 끝 - v3.1 Design Doc (2026-02-13)*
