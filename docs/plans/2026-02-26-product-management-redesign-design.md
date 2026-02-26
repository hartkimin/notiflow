# 품목관리 페이지 전체 개편 설계

> 날짜: 2026-02-26
> 상태: 승인됨

## 목표

기존 `products` 테이블과 품목관리 페이지를 전면 교체하여:
1. 식약처 API 컬럼과 DB 컬럼을 1:1 매칭
2. 의약품/의료기기 2개 탭 구조
3. 개별 동기화 기능으로 API 변경사항 감지 및 적용

## 결정사항

| 항목 | 결정 |
|------|------|
| DB 구조 | 테이블 2개 분리 (my_drugs, my_devices) |
| 동기화 방식 | 개별 행 동기화 (standard_code로 API 조회) |
| 기존 기능 | 모두 제거 (별칭, 카테고리, 단가 등) |
| 페이지 구조 | 2페이지 유지 (/products 검색, /products/my 관리) |
| 접근 방식 | A+C 하이브리드 (DB 재작성 + MfdsSearchPanel mode 확장) |
| 컬럼명 | PostgreSQL 관례 소문자 snake_case |

## 데이터베이스

### my_drugs (의약품 24 API 컬럼 + 관리 2 컬럼)

```sql
CREATE TABLE my_drugs (
  id SERIAL PRIMARY KEY,
  item_seq TEXT,
  item_name TEXT,
  item_eng_name TEXT,
  entp_name TEXT,
  entp_no TEXT,
  item_permit_date TEXT,
  cnsgn_manuf TEXT,
  etc_otc_code TEXT,
  chart TEXT,
  bar_code TEXT UNIQUE,
  material_name TEXT,
  ee_doc_id TEXT,
  ud_doc_id TEXT,
  nb_doc_id TEXT,
  storage_method TEXT,
  valid_term TEXT,
  pack_unit TEXT,
  edi_code TEXT,
  permit_kind_name TEXT,
  cancel_date TEXT,
  cancel_name TEXT,
  change_date TEXT,
  atc_code TEXT,
  rare_drug_yn TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);
```

### my_devices (의료기기 20 API 컬럼 + 관리 2 컬럼)

```sql
CREATE TABLE my_devices (
  id SERIAL PRIMARY KEY,
  udidi_cd TEXT UNIQUE,
  prdlst_nm TEXT,
  mnft_iprt_entp_nm TEXT,
  mdeq_clsf_no TEXT,
  clsf_no_grad_cd TEXT,
  permit_no TEXT,
  prmsn_ymd TEXT,
  foml_info TEXT,
  prdt_nm_info TEXT,
  hmbd_trspt_mdeq_yn TEXT,
  dspsbl_mdeq_yn TEXT,
  trck_mng_trgt_yn TEXT,
  total_dev TEXT,
  cmbnmd_yn TEXT,
  use_before_strlzt_need_yn TEXT,
  sterilization_method_nm TEXT,
  use_purps_cont TEXT,
  strg_cnd_info TEXT,
  circ_cnd_info TEXT,
  rcprslry_trgt_yn TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);
```

### 삭제 대상

- `products` 테이블 DROP
- `product_aliases` 테이블 DROP (존재 시)
- 관련 RLS 정책, 인덱스, 함수 제거

## UI 구조

### /products (검색) — 기존 유지

`MfdsSearchPanel mode="browse"` 그대로. "추가" 버튼 동작만 새 테이블로 변경.

### /products/my (관리) — 전면 개편

`MfdsSearchPanel mode="manage"` 신규 모드:

```
┌─────────────────────────────────────────┐
│  [의약품]  [의료기기]        ← 탭 전환   │
├─────────────────────────────────────────┤
│  🔍 검색 (DB 내 클라이언트 필터)         │
│  필터 칩 | 컬럼 설정                     │
├─────────────────────────────────────────┤
│  결과: N건                  [컬럼 설정]  │
├──┬──────┬─────┬─────┬──────────────────┤
│  │품목명│업체명│코드 │     [🔄동기화]   │
├──┼──────┼─────┼─────┼──────────────────┤
│ ▸│ ...  │ ... │ ... │     [🔄동기화]   │
└──┴──────┴─────┴─────┴──────────────────┘
```

### MfdsSearchPanel mode 비교

| 구분 | browse | manage |
|------|--------|--------|
| 데이터 소스 | MFDS API | DB (my_drugs/my_devices) |
| 검색 | API 서버 검색 | 클라이언트 필터링 |
| 액션 버튼 | "추가" | "동기화" |
| 페이지네이션 | API 페이지 | 클라이언트 페이징 |

## 동기화 플로우

```
[동기화] 클릭
  → API 조회 (bar_code / udidi_cd)
  → DB값과 비교
  → 변경 없음 → 토스트 "최신 상태" + synced_at 갱신
  → 변경 있음 → Diff 다이얼로그:
      컬럼명 | 현재값 | → 새값
      ────── | ────── | ──────
      ...    | ...    | ...
      [적용] [취소]
  → 적용 시 DB 업데이트 + synced_at 갱신
```

## 서버 액션

```typescript
// 추가 (검색에서 호출)
addToMyDrugs(item: MfdsDrugItem)
addToMyDevices(item: MfdsDeviceStdItem)

// 조회 (관리 페이지)
getMyDrugs(): MyDrug[]
getMyDevices(): MyDevice[]

// 동기화
syncMyDrug(id: number): { changes: DiffEntry[], apiItem: MfdsDrugItem } | null
syncMyDevice(id: number): { changes: DiffEntry[], apiItem: MfdsDeviceStdItem } | null

// 적용
applyDrugSync(id: number, updates: Partial<MyDrug>)
applyDeviceSync(id: number, updates: Partial<MyDevice>)

// 삭제
deleteMyDrug(id: number)
deleteMyDevice(id: number)
```

## 삭제 대상 (기존 코드)

- `addMfdsItemToProducts()` 서버 액션
- `ProductSearch`, `ProductTable`, `ProductFormDialog` 컴포넌트
- `Product` 타입 정의
- `/products/my` 기존 페이지 컴포넌트
- `products` 테이블 관련 모든 코드
