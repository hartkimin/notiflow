# MFDS 직접 API 검색 설계

> 기존 전체 동기화 방식을 폐기하고, MFDS API 직접 검색으로 전환

## 배경

기존 방식: 3개 MFDS API 데이터를 `mfds_items` 테이블에 전체 동기화 → 수십만 건 저장, 최신성 보장 어려움, 동기화 실패 리스크.

새 방식: MFDS API를 실시간 직접 검색하고, 주문에서 선택한 품목만 `products` 테이블에 저장.

## 결정 사항

| 항목 | 결정 |
|------|------|
| API 구성 | 2개 (의약품 허가정보, 의료기기 표준코드). 의료기기 품목정보 API 폐기 |
| UI 구조 | 탭 2개 (의약품 / 의료기기) |
| 검색 필드 | 품목명 + 업체명 + 코드 (3개) |
| 결과 표시 | 가로 스크롤 전체 컬럼 테이블 |
| 주문생성 연동 | 동일 검색 컴포넌트 인라인 표시 (mode="pick") |
| products 저장 | JSONB 원본 + 기존 매핑 필드 |
| 기존 인프라 | 완전 삭제 (mfds_items, mfds_sync_logs, sync-mfds EF, pg_cron) |
| API 호출 방식 | Next.js Server Actions |

## 1. 페이지 구조

```
/products        → MFDS API 실시간 검색 (전면 교체)
/products/my     → 내 품목 CRUD (기존 products 테이블, 주문에서 선택된 것만)
/orders          → 주문 관리 (기존 유지, 품목 추가 시 인라인 MFDS 검색)
```

## 2. API 엔드포인트

### 의약품 허가정보 (DrugPrdtPrmsnInfoService07)
- URL: `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06`
- 검색 파라미터: `ITEM_NAME`, `ENTP_NAME`, `ITEM_SEQ`
- 응답 필드: ITEM_SEQ, ITEM_NAME, ENTP_NAME, ENTP_NO, ITEM_PERMIT_DATE, BAR_CODE, EDI_CODE, ATC_CODE, MAIN_ITEM_INGR, BIZRNO, RARE_DRUG_YN

### 의료기기 표준코드 (MdeqStdCdPrdtInfoService03)
- URL: `https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03`
- 검색 파라미터: `PRDLST_NM`, `MNFT_IPRT_ENTP_NM`, `UDIDI_CD`
- 응답 필드: UDIDI_CD, PRDLST_NM, MNFT_IPRT_ENTP_NM, PERMIT_NO, PRMSN_YMD, MDEQ_CLSF_NO, CLSF_NO_GRAD_CD, PRDT_NM_INFO, USE_PURPS_CONT, FOML_INFO, HMBD_TRSPT_MDEQ_YN, DSPSBL_MDEQ_YN, TRCK_MNG_TRGT_YN, TOTAL_DEV, CMBNMD_YN, USE_BEFORE_STRLZT_NEED_YN, STERILIZATION_METHOD_NM, STRG_CND_INFO, CIRC_CND_INFO, RCPRSLRY_TRGT_YN

## 3. 데이터 흐름

```
클라이언트 (MfdsSearchPanel)
  → Server Action: searchMfdsDrug / searchMfdsDevice
    → apis.data.go.kr 호출
    → 파싱 & 반환: { items, totalCount, pageNo }

품목 선택 시:
  → Server Action: addMfdsItemToProducts(item, sourceType)
    → products 테이블 upsert (standard_code 기준 중복 체크)
    → mfds_raw JSONB에 원본 저장 + 매핑 필드 채움
```

## 4. DB 변경

### products 테이블 수정
```sql
ALTER TABLE products ADD COLUMN mfds_raw JSONB;
ALTER TABLE products ADD COLUMN mfds_source_type TEXT;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_mfds_item_id_fkey;
ALTER TABLE products DROP COLUMN IF EXISTS mfds_item_id;
```

### 삭제
```sql
DROP TABLE IF EXISTS mfds_items CASCADE;
DROP TABLE IF EXISTS mfds_sync_logs CASCADE;
DROP FUNCTION IF EXISTS update_products_from_mfds;
```

## 5. 컴포넌트 구조

```
MfdsSearchPanel (공유 컴포넌트)
├── props: { onSelect?, mode: 'browse' | 'pick' }
├── MfdsTabSwitcher (의약품 / 의료기기)
├── MfdsSearchForm (품목명, 업체명, 코드)
├── MfdsResultTable (가로 스크롤, 전체 컬럼)
│   ├── mode='browse': "내 품목에 추가" 버튼
│   └── mode='pick': "선택" 버튼 (주문생성용)
└── Pagination
```

사용처:
- `/products` → `<MfdsSearchPanel mode="browse" />`
- `/orders` 주문생성 → `<MfdsSearchPanel mode="pick" onSelect={handleAddToOrder} />`

## 6. Server Actions

| Action | 용도 |
|--------|------|
| `searchMfdsDrug(filters, page)` | 의약품 API 검색 |
| `searchMfdsDevice(filters, page)` | 의료기기 표준코드 API 검색 |
| `addMfdsItemToProducts(item, sourceType)` | 검색 결과 → products 저장 |

## 7. 삭제 대상

### 파일 삭제
- `packages/supabase/functions/sync-mfds/` (Edge Function 전체)
- `docs/plans/00025_mfds_cron_setup.sql`

### 코드 삭제
- `triggerMfdsSync` Server Action (actions.ts)
- `MfdsSyncPanel` 컴포넌트
- Settings 페이지 동기화 관련 UI
- `update_products_from_mfds` RPC 함수

### DB 삭제 (마이그레이션)
- `mfds_items` 테이블
- `mfds_sync_logs` 테이블
- 관련 인덱스, enum, 트리거

## 8. 에러 처리

| 상황 | 처리 |
|------|------|
| API 응답 지연 (>3초) | 로딩 스피너 + 스켈레톤 테이블 |
| API 오류 | toast 에러 메시지, 재시도 버튼 |
| 검색 결과 0건 | "검색 결과가 없습니다" 안내 |
| 이미 내 품목에 있는 항목 | "추가됨" 뱃지 (standard_code 매칭) |
| API 키 미설정 | settings 페이지 안내 경고 배너 |
