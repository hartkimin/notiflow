# MFDS 품목 검색 페이지 UI/UX 개선 설계

**날짜:** 2026-02-27
**접근법:** 기존 컴포넌트 점진적 확장 (접근법 A)
**영향 파일:** 6개 기존 컴포넌트 수정, 새 파일 없음

---

## 1. 메인 검색 기능 개선

### 변경 요약
검색 입력 왼쪽에 컬럼 선택 드롭다운 추가. 기존 스마트 필드 감지(`detectSearchFields`)를 드롭다운이 대체.

### 수정 파일
- `mfds-search-bar.tsx` — 드롭다운 UI 추가
- `mfds-search-utils.ts` — `detectSearchFields()` → `getSearchableColumns(tab)` 대체

### 드롭다운 옵션

**의약품:**
| 옵션 | API 필드 |
|------|----------|
| 전체 (기본) | 순차 검색: ITEM_NAME → ENTP_NAME → BAR_CODE |
| 품목명 | ITEM_NAME |
| 업체명 | ENTP_NAME |
| 표준코드 | BAR_CODE |
| 보험코드 | EDI_CODE |
| ATC코드 | ATC_CODE |
| 품목기준코드 | ITEM_SEQ |
| 허가종류 | PERMIT_KIND_NAME |
| 상태 | CANCEL_NAME |

**의료기기:**
| 옵션 | API 필드 |
|------|----------|
| 전체 (기본) | 순차 검색: PRDLST_NM → MNFT_IPRT_ENTP_NM → UDIDI_CD |
| 품목명 | PRDLST_NM |
| 업체명 | MNFT_IPRT_ENTP_NM |
| UDI-DI | UDIDI_CD |
| 품목허가번호 | PERMIT_NO |
| 분류번호 | MDEQ_CLSF_NO |
| 등급 | CLSF_NO_GRAD_CD |
| 모델명 | FOML_INFO |

### "전체" 검색 동작
1. 품목명 필드로 먼저 검색
2. 결과 0건이면 업체명으로 재시도
3. 숫자 패턴이면 코드 필드도 시도

---

## 2. 필터 기능 확장

### 변경 요약
필터 대상을 전체 컬럼으로 확장. 컬럼 타입별 연산자 제공. AND/OR 토글 추가.

### 수정 파일
- `mfds-search-bar.tsx` — 필터 드롭다운 확장, 연산자 선택 추가
- `mfds-search-panel.tsx` — `filterLogic` 상태 추가
- `mfds-search-utils.ts` — `getColumnType(field)` 함수 추가

### FilterChip 타입 변경
```typescript
interface FilterChip {
  field: string
  label: string
  value: string
  operator: "contains" | "equals" | "startsWith" | "notContains" | "before" | "after" | "between"
}
```

### 컬럼 타입별 연산자

| 타입 | 해당 필드 | 연산자 |
|------|-----------|--------|
| 텍스트 | 대부분 | 포함, 일치, 시작, 제외 |
| 날짜 | ITEM_PERMIT_DATE, PRMSN_YMD, CANCEL_DATE, CHANGE_DATE | 이전, 이후, 범위 |
| 상태 | CANCEL_NAME, CLSF_NO_GRAD_CD, ETC_OTC_CODE | 체크박스 선택 |

### 필터 적용 계층
1. **API 레벨 (AND):** contains/equals 필터를 API 파라미터로 전달
2. **클라이언트 레벨:** 나머지 연산자 + OR 조건은 TanStack filterFn으로 처리

### AND/OR 토글
- 필터 칩 영역에 AND/OR 토글 버튼
- 기본값: AND
- OR 선택 시 클라이언트 사이드에서 결과 병합

---

## 3. 결과 내 검색 위치 재조정

### 수정 파일
- `mfds-result-toolbar.tsx`

### 레이아웃 변경
```
변경 전: [총 XX건]                    [결과 내 검색] [컬럼]
변경 후: [총 XX건]  [결과 내 검색]                [표시 항목]
```

globalFilter Input을 건수 표시 오른쪽(좌측 영역)으로 이동.

---

## 4. 컬럼 표시/숨김 버튼 라벨 변경

### 수정 파일
- `mfds-result-toolbar.tsx`

### 변경
- 버튼: `"컬럼"` → `"표시 항목"`
- 드롭다운 제목: `"표시할 컬럼"` → `"표시할 항목"`

---

## 5. 컬럼 너비 조절 — 더블클릭 auto-fit

### 수정 파일
- `mfds-result-table.tsx`

### 구현
- 컬럼 헤더에 `onDoubleClick` 핸들러 추가
- 해당 컬럼의 보이는 행 텍스트 길이 측정
- `column.setSize(maxWidth)` 호출
- 제한: 최소 100px, 최대 500px
- 기존 드래그 리사이즈는 그대로 유지

---

## 6. 아코디언 상세 정보 확장

### 수정 파일
- `mfds-row-detail.tsx`

### 변경 요약
전체 필드 표시 + 복사 버튼 + 줄바꿈 처리. URL 필드는 텍스트로 표시.

### 의약품 필드 그룹 (24개 전체)

**기본 정보:** ITEM_SEQ, ITEM_NAME, ITEM_ENG_NAME, ENTP_NAME, ENTP_NO, CNSGN_MANUF, PACK_UNIT

**분류/허가:** ETC_OTC_CODE, PERMIT_KIND_NAME, BAR_CODE, EDI_CODE, ATC_CODE, CANCEL_NAME, CANCEL_DATE, ITEM_PERMIT_DATE, CHANGE_DATE, RARE_DRUG_YN

**상세 정보:** MATERIAL_NAME, CHART, STORAGE_METHOD, VALID_TERM, EE_DOC_ID, UD_DOC_ID, NB_DOC_ID

### 의료기기 필드 그룹 (20개 전체)

**기본 정보:** PRDLST_NM, PRDT_NM_INFO, MNFT_IPRT_ENTP_NM, FOML_INFO, TOTAL_DEV

**분류/허가:** MDEQ_CLSF_NO, CLSF_NO_GRAD_CD, UDIDI_CD, PERMIT_NO, PRMSN_YMD, USE_PURPS_CONT

**관리/보관:** DSPSBL_MDEQ_YN, HMBD_TRSPT_MDEQ_YN, TRCK_MNG_TRGT_YN, CMBNMD_YN, RCPRSLRY_TRGT_YN, USE_BEFORE_STRLZT_NEED_YN, STERILIZATION_METHOD_NM, STRG_CND_INFO, CIRC_CND_INFO

### 공통 UX
- 각 필드 값 옆에 복사 아이콘 (clipboard API)
- 빈 값: "-" 표시
- 긴 텍스트: `whitespace-pre-wrap` + `break-words`
- URL 필드 (EE_DOC_ID 등): 텍스트 표시 + 복사 버튼
