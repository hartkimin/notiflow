# MFDS DB 검색 개선 설계

> 날짜: 2026-02-27
> 상태: 승인됨

## 문제

현재 식약처(MFDS) 검색은 API를 직접 호출하여 25건/페이지를 반환하며, 결과 내 필터(globalFilter)는 현재 페이지의 25건에서만 동작함. 전체 데이터를 대상으로 한 검색이 불가능.

## 접근 방식

**방식 A 채택:** Supabase DB에 mfds_items 테이블을 재생성하고, UPSERT 기반 전체 동기화 + pg_trgm 서버 사이드 검색으로 전환.

## 1. 데이터베이스 스키마

### mfds_items 테이블 재생성

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE mfds_items (
  id              BIGSERIAL PRIMARY KEY,
  source_type     TEXT NOT NULL,         -- 'drug' | 'device_std'
  source_key      TEXT NOT NULL,         -- ITEM_SEQ 또는 UDIDI_CD
  item_name       TEXT NOT NULL,         -- 품목명 (검색용 정규화)
  manufacturer    TEXT,                  -- 업체명 (검색용 정규화)
  standard_code   TEXT,                  -- 표준코드/UDI-DI코드
  permit_date     TEXT,                  -- 허가일자
  raw_data        JSONB NOT NULL,        -- API 응답 원본 전체 보존
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_key)
);

-- 인덱스
CREATE INDEX idx_mfds_items_name_trgm ON mfds_items USING gin (item_name gin_trgm_ops);
CREATE INDEX idx_mfds_items_mfr_trgm ON mfds_items USING gin (manufacturer gin_trgm_ops);
CREATE INDEX idx_mfds_items_source_type ON mfds_items (source_type);
CREATE INDEX idx_mfds_items_standard_code ON mfds_items (standard_code) WHERE standard_code IS NOT NULL;
CREATE INDEX idx_mfds_items_raw_data ON mfds_items USING gin (raw_data jsonb_path_ops);

-- RLS
ALTER TABLE mfds_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_items"
  ON mfds_items FOR SELECT TO authenticated USING (true);
```

### mfds_sync_logs 테이블

```sql
CREATE TABLE mfds_sync_logs (
  id            BIGSERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running',
  trigger_type  TEXT NOT NULL,     -- 'cron' | 'manual'
  source_type   TEXT,              -- 'drug' | 'device_std' | null (전체)
  total_fetched INT DEFAULT 0,
  total_upserted INT DEFAULT 0,
  error_message TEXT,
  duration_ms   INT
);

ALTER TABLE mfds_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_sync_logs"
  ON mfds_sync_logs FOR SELECT TO authenticated USING (true);
```

### updated_at 트리거

```sql
CREATE TRIGGER update_mfds_items_updated_at
  BEFORE UPDATE ON mfds_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 2. 동기화 시스템

### Edge Function: sync-mfds (재구현)

- 100건/페이지 × 20페이지 = 최대 2,000건/호출
- Caller-driven chunking: server action이 hasMore/nextPage 기반 반복
- UPSERT: `ON CONFLICT (source_type, source_key) DO UPDATE ... WHERE raw_data IS DISTINCT FROM EXCLUDED.raw_data`
- Drug: `getDrugPrdtPrmsnDtlInq06` → source_key = ITEM_SEQ
- Device: `getMdeqStdCdPrdtInfoInq03` → source_key = UDIDI_CD

### 동기화 스케줄

- pg_cron: 매일 자동 실행
- 수동: 웹 UI 동기화 버튼

## 3. 검색 아키텍처

### Server Action: searchMfdsItems

```typescript
searchMfdsItems(params: {
  query: string;
  sourceType: 'drug' | 'device_std';
  page?: number;
  pageSize?: number;
  filters?: { field: string; operator: string; value: string }[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) → { items: MfdsItem[]; totalCount: number; page: number }
```

- 통합 검색: `item_name ILIKE '%query%' OR manufacturer ILIKE '%query%' OR standard_code ILIKE '%query%'`
- pg_trgm 인덱스 활용으로 한글 부분 일치 검색 지원
- 서버 사이드 페이지네이션 (OFFSET/LIMIT)
- 서버 사이드 정렬 (ORDER BY)

### 클라이언트 검색 흐름

```
사용자 타이핑 → debounce(300ms) → searchMfdsItems() → 결과 렌더링
```

## 4. UI 변경사항

### MfdsSearchPanel 수정

- 검색 버튼 제거 → debounce 자동검색
- 결과 내 필터(globalFilter) 제거 → 검색바에서 전체 검색
- 필드 선택은 선택사항 (기본: 전체 필드 검색)
- 고급 필터 칩 유지
- 페이지네이션: 서버 사이드로 전환
- 정렬: 서버 사이드로 전환
- manage 모드: 변경 없음

### raw_data → 테이블 컬럼 매핑

클라이언트에서 raw_data JSONB를 파싱하여 기존 컬럼 정의에 매핑.

## 5. 에러 처리

| 시나리오 | 처리 |
|---------|------|
| DB 미동기화 | 안내 + 동기화 버튼 |
| 동기화 중 검색 | 기존 데이터로 검색 |
| 결과 0건 | 안내 메시지 |
| debounce 중 새 입력 | AbortController로 이전 요청 취소 |
| 동기화 실패 | sync_logs 에러 기록 |
| API 키 미설정 | 설정 페이지 안내 |
