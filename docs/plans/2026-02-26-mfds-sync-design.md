# 식약처 API → 품목관리 DB 동기화 설계

> 날짜: 2026-02-26
> 상태: 승인됨

## 개요

식약처 3개 API(의약품/의료기기 품목/의료기기 UDI) 데이터를 통합 테이블(`mfds_items`)에 일괄 저장하고, `products` 테이블과 FK로 연결하여 자동 갱신하는 시스템.

기존 실시간 API 검색 → 로컬 DB 검색으로 전환하며, 수동 버튼 + 매일 새벽 5시 자동 동기화로 데이터를 최신 상태로 유지.

## DB 스키마

### mfds_items (통합 식약처 데이터)

```sql
CREATE TYPE mfds_source_type AS ENUM ('drug', 'device', 'device_std');

CREATE TABLE mfds_items (
  id                  BIGSERIAL PRIMARY KEY,
  source_type         mfds_source_type NOT NULL,
  source_key          VARCHAR(100) NOT NULL,

  -- 공통 컬럼
  item_name           VARCHAR(500) NOT NULL,
  manufacturer        VARCHAR(255),
  permit_no           VARCHAR(100),
  permit_date         VARCHAR(20),
  standard_code       VARCHAR(100),
  classification_no   VARCHAR(100),
  classification_grade VARCHAR(10),
  product_name        VARCHAR(500),
  use_purpose         TEXT,

  -- 의약품(drug) 전용
  edi_code            VARCHAR(50),
  atc_code            VARCHAR(50),
  main_item_ingr      TEXT,
  bizrno              VARCHAR(20),
  rare_drug_yn        VARCHAR(5),

  -- 의료기기 품목(device) 전용
  mnsc_nm             VARCHAR(255),
  mnsc_natn_cd        VARCHAR(50),
  prmsn_dclr_divs_nm  VARCHAR(50),

  -- 의료기기 표준코드(device_std) 전용
  foml_info           VARCHAR(500),
  hmbd_trspt_mdeq_yn  VARCHAR(5),
  dspsbl_mdeq_yn      VARCHAR(5),
  trck_mng_trgt_yn    VARCHAR(5),
  total_dev           VARCHAR(5),
  cmbnmd_yn           VARCHAR(5),
  use_before_strlzt_need_yn VARCHAR(5),
  sterilization_method VARCHAR(255),
  strg_cnd_info       VARCHAR(255),
  circ_cnd_info       VARCHAR(255),
  rcprslry_trgt_yn    VARCHAR(5),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source_type, source_key)
);
```

### 컬럼 매핑

| 공통 컬럼 | Drug API | Device API | Device Std API |
|---|---|---|---|
| source_key | item_seq | prdlst_sn | udidi_cd |
| item_name | item_name | prdlst_nm | prdlst_nm |
| manufacturer | entp_name | mnft_clnt_nm | mnft_iprt_entp_nm |
| permit_no | entp_no | meddev_item_no | permit_no |
| permit_date | item_permit_date | prmsn_ymd | prmsn_ymd |
| standard_code | bar_code | — | udidi_cd |
| classification_no | — | mdeq_clsf_no | mdeq_clsf_no |
| classification_grade | — | clsf_no_grad_cd | clsf_no_grad_cd |
| product_name | — | prdt_nm_info | prdt_nm_info |
| use_purpose | — | use_purps_cont | use_purps_cont |

### products 변경

```sql
ALTER TABLE products ADD COLUMN mfds_item_id BIGINT REFERENCES mfds_items(id) ON DELETE SET NULL;
```

### mfds_sync_logs (동기화 이력)

```sql
CREATE TABLE mfds_sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  trigger_type    VARCHAR(20) NOT NULL,
  triggered_by    UUID REFERENCES auth.users(id),

  drug_total      INT DEFAULT 0,
  drug_added      INT DEFAULT 0,
  drug_updated    INT DEFAULT 0,
  device_total    INT DEFAULT 0,
  device_added    INT DEFAULT 0,
  device_updated  INT DEFAULT 0,
  device_std_total INT DEFAULT 0,
  device_std_added INT DEFAULT 0,
  device_std_updated INT DEFAULT 0,
  products_updated INT DEFAULT 0,

  error_message   TEXT,
  duration_ms     INT
);
```

## 동기화 아키텍처

### Edge Function: sync-mfds

- 위치: `packages/supabase/functions/sync-mfds/index.ts`
- 호출: `POST /functions/v1/sync-mfds`
- Body: `{ "trigger": "manual"|"scheduled", "source": "drug"|"device"|"device_std", "user_id": "<optional>" }`
- API별 분리 호출 (타임아웃 방지)

### 동기화 알고리즘

```
for page = 1 to ceil(totalCount / 100):
  fetch API(pageNo=page, numOfRows=100)
  UPSERT into mfds_items ON CONFLICT (source_type, source_key)
  track added/updated counts

UPDATE linked products WHERE mfds_item_id IN (updated mfds_items)
UPDATE mfds_sync_logs SET status='success', stats, duration
```

### products 자동 갱신

```sql
UPDATE products p SET
  official_name = m.item_name,
  manufacturer  = m.manufacturer,
  ingredient    = COALESCE(m.main_item_ingr, m.use_purpose),
  efficacy      = m.use_purpose,
  standard_code = m.standard_code,
  updated_at    = NOW()
FROM mfds_items m
WHERE p.mfds_item_id = m.id
  AND m.updated_at > <sync_started_at>;
```

### pg_cron 스케줄

```sql
-- API별 5분 간격 순차 호출 (UTC 20:00/05/10 = KST 05:00/05/10)
SELECT cron.schedule('sync-mfds-drug',       '0 20 * * *',  $$ ... source=drug $$);
SELECT cron.schedule('sync-mfds-device',     '5 20 * * *',  $$ ... source=device $$);
SELECT cron.schedule('sync-mfds-device-std', '10 20 * * *', $$ ... source=device_std $$);
```

### 에러 핸들링

| 상황 | 처리 |
|---|---|
| API 키 미등록 | failed + 에러 메시지, 즉시 종료 |
| API 응답 오류 | 해당 API 건너뛰고 부분 실패 기록 |
| 타임아웃 | 중단 지점까지 저장 |
| 중복 실행 방지 | running 상태 있으면 새 동기화 거부 |

## UI 변경

### 설정 페이지 — 동기화 관리 패널

- 마지막 동기화 시각 + 상태 표시
- 수동 동기화 버튼 (진행 중 비활성화 + 스피너)
- API별 데이터 현황 (총 건수, 최종 갱신일)
- 동기화 이력 테이블 (시작시간, 유형, 추가/갱신 건수, 소요시간, 상태)

### DrugSearchDialog — 로컬 DB 검색 전환

- 데이터 소스: 식약처 API → mfds_items 테이블 조회
- 검색 속도: 1-3초 → <100ms
- 하단에 마지막 동기화 시각 표시

### 제품 생성 시 연결

- mfds_items에서 선택 → products에 mfds_item_id FK 저장
- category 자동 매핑: drug→medication, device/device_std→분류번호 기반

## 마이그레이션 전략

### Phase 1: 스키마 생성
- mfds_items, mfds_sync_logs 테이블 생성
- products에 mfds_item_id 추가

### Phase 2: 초기 동기화
- sync-mfds Edge Function 배포 → 수동 동기화 실행

### Phase 3: 기존 데이터 연결

```sql
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_drug_api'
  AND m.source_type = 'drug'
  AND m.source_key = p.auto_info->>'item_seq';
-- device, device_std도 동일 패턴
```

### Phase 4: 코드 전환
- DrugSearchDialog → 로컬 DB 검색
- 기존 API route 제거 가능
- pg_cron 스케줄 등록

## 파일 변경 목록

### 신규
| 파일 | 설명 |
|---|---|
| `packages/supabase/migrations/00022_mfds_items.sql` | 스키마 |
| `packages/supabase/functions/sync-mfds/index.ts` | Edge Function |
| `apps/web/src/components/mfds-sync-panel.tsx` | 동기화 관리 UI |

### 변경
| 파일 | 내용 |
|---|---|
| `apps/web/src/components/drug-search-dialog.tsx` | 로컬 DB 검색 전환 |
| `apps/web/src/components/product-list.tsx` | mfds_item_id 연결 |
| `apps/web/src/lib/types.ts` | MfdsItem 타입 추가 |
| `apps/web/src/lib/actions.ts` | mfds_item_id 반영 |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | 동기화 패널 삽입 |

### 삭제 가능 (전환 완료 후)
| 파일 | 사유 |
|---|---|
| `apps/web/src/app/api/drug-search/route.ts` | 로컬 DB로 대체 |
| `apps/web/src/app/api/device-search/route.ts` | 동일 |
| `apps/web/src/app/api/device-std-search/route.ts` | 동일 |
