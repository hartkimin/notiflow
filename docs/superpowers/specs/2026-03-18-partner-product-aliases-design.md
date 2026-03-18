# Partner Product Aliases (업체별 취급품목 별칭)

**Date:** 2026-03-18
**Status:** Approved

## Overview

공급사/병원 탭에서 각 업체의 취급품목에 별칭(alias)을 추가하는 기능. 별칭은 태그처럼 동작하여 다른 용어로도 품목을 매칭할 수 있게 한다. 수동 검색에서 즉시 활용되며, 주문서 자동 매칭은 후속 작업으로 분리한다.

### Constraints

- 한 취급품목당 최대 5개 별칭
- 업체마다 별칭은 개별 관리 (같은 품목이라도 업체별로 다른 별칭 가능)
- 같은 업체 내에서 서로 다른 품목에 동일 별칭 불가
- 정규화: 공백 + 특수문자 + 대소문자 제거 후 비교
- 별칭 텍스트: 최소 1자, 최대 50자, 정규화 후 빈 문자열이면 거부

## 1. Database Schema

### 1-1. Normalization Function

```sql
create function normalize_alias(input text) returns text as $$
  select lower(regexp_replace(input, '[[:space:][:punct:]]', '', 'g'));
$$ language sql immutable;
```

공백, 특수문자(하이픈, 점, 괄호, `·`, `~` 등), 대소문자를 모두 제거한 문자열을 반환한다. `immutable`로 선언하여 인덱스에서 사용 가능. 한글 본문 문자는 보존된다.

> **Note:** `[:punct:]` POSIX 클래스는 ASCII 구두점 외에 유니코드 구두점(중점 `·` 등)도 PostgreSQL에서 처리한다. 마이그레이션 시 한글 혼합 입력에 대해 테스트 케이스를 포함할 것.

### 1-2. Table

```sql
create table partner_product_aliases (
  id                 serial primary key,
  partner_product_id integer not null references partner_products(id) on delete cascade,
  alias              text not null check (char_length(alias) between 1 and 50),
  alias_normalized   text not null check (alias_normalized <> ''),
  match_count        integer not null default 0,
  last_matched_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
```

`partner_products.id`가 `SERIAL`(integer)이므로 FK도 `integer`로 맞춘다. PK도 프로젝트 전체 패턴에 맞춰 `SERIAL`로 통일한다.

### 1-3. Constraints & Indexes

- `UNIQUE(partner_product_id, alias_normalized)` — 같은 품목에 정규화 기준 동일 별칭 불가
- **업체 내 유니크 트리거** (BEFORE INSERT): `partner_products`를 조인하여 같은 `partner_type + partner_id` 내에 동일 `alias_normalized`가 존재하는지 검사. 존재하면 에러(충돌 품목명 포함).
- **5개 제한 트리거** (BEFORE INSERT): 해당 `partner_product_id`의 기존 별칭 수가 5 이상이면 에러.
- `GIN index` on `alias_normalized` using `gin_trgm_ops` — pg_trgm 유사도 검색용
- `B-tree index` on `partner_product_id` — JOIN 성능용
- `updated_at` 트리거: 기존 `update_updated_at_column()` 함수 재사용

### 1-4. Validation Layers

서버 액션에서 사전 검증(사용자 친화적 에러 메시지)을 수행하고, DB 트리거는 safety net으로 동작한다:
- **앱 레이어**: 빈 문자열, 50자 초과, 정규화 후 빈 문자열, 5개 초과, 업체 내 중복 → 구체적 한국어 에러 메시지 반환
- **DB 레이어**: CHECK 제약조건 + 트리거 → 동시성 이슈 등 앱 레이어를 우회한 경우의 최종 방어

### 1-5. RLS Policies

기존 `partner_products` RLS 패턴과 동일하게 permissive 적용:
- `SELECT`: `USING (true)` — public read
- `ALL` (INSERT/UPDATE/DELETE): `TO authenticated USING (true) WITH CHECK (true)`

이는 `partner_products`의 기존 정책과 일치한다.

## 2. Search Integration

### 2-1. Manual Search (취급품목 목록 필터링)

현재 `PartnerProductManager`는 클라이언트사이드에서 `filteredProducts` memo로 검색 필터링을 수행한다. 이 패턴을 유지한다:

- `getPartnerProducts` 서버 액션 수정: LEFT JOIN으로 `aliases: {id, alias}[]` 배열을 함께 반환
- 클라이언트 `filteredProducts` memo 확장: 품목명 + `aliases` 배열의 정규화된 값으로 필터링
- 별칭으로 매칭된 품목은 해당 별칭 칩을 하이라이트 표시

서버사이드 검색으로의 전환 없이, 기존 아키텍처를 그대로 유지한다.

### 2-2. Auto Matching (주문서 텍스트 매칭) — Future Enhancement

주문서 파싱 시 별칭을 활용한 자동 매칭은 이번 스코프에 포함하지 않는다. `match_count`와 `last_matched_at` 컬럼은 향후 통합을 위해 스키마에 미리 포함해둔다.

향후 매칭 우선순위 (참고):
1. 품명 정확 일치
2. 별칭 정확 일치 (정규화 기준)
3. 품명 유사도 (pg_trgm)
4. 별칭 유사도 (pg_trgm)

## 3. UI Interaction

### 3-1. Display

`PartnerProductManager` 내 각 품목 행 아래에 별칭 영역:

```
┌─────────────────────────────────────────────────┐
│ 프레제니우스 4008S 투석기    단가: ₩150,000      │
│ [투석필터] [FMC필터] [4008에스]          [+ 별칭] │
└─────────────────────────────────────────────────┘
```

- 별칭: shadcn `Badge` (variant="secondary"), 각 칩에 `×` 삭제 버튼
- `[+ 별칭]` 버튼: 별칭이 5개 미만일 때만 표시
- 별칭이 없으면 `[+ 별칭]` 버튼만 표시

### 3-2. Add Flow

1. `[+ 별칭]` 클릭 → 칩 영역 끝에 인라인 텍스트 입력 필드
2. 입력 후 Enter 또는 포커스 아웃 → 서버 저장 요청
3. 에러 시 인라인 메시지 표시
4. 성공 시 새 칩 추가, 입력 필드 닫힘
5. ESC → 입력 취소

### 3-3. Delete Flow

칩의 `×` 클릭 → optimistic delete:
1. UI에서 즉시 칩 제거
2. 되돌리기 토스트 표시 (3초 카운트다운)
3. 사용자가 "되돌리기" 클릭 → 칩 복원, 서버 호출 취소
4. 3초 경과 → 실제 서버 DELETE 호출
5. 서버 호출 실패 시 칩 복원 + 에러 토스트

### 3-4. Search Highlight

`listSearch`로 검색 시 별칭이 매칭된 경우, 해당 별칭 칩을 강조 표시 (variant="default" 또는 배경색 변경).

## 4. Server Actions & Types

### 4-1. New Server Actions

```typescript
addPartnerProductAlias(partnerProductId: number, alias: string)
// → trim → length check (1-50) → normalize → empty check
// → duplicate check (same item, same partner) → INSERT
// → returns {id, alias, alias_normalized}

deletePartnerProductAlias(aliasId: number)
// → DELETE → void
```

### 4-2. Modified Server Actions

```typescript
getPartnerProducts(partnerType, partnerId)
// → LEFT JOIN partner_product_aliases
// → returns PartnerProduct[] with aliases: {id, alias}[]
// (search parameter 추가 없음 — 클라이언트사이드 필터링 유지)
```

### 4-3. Error Messages

| Condition | Message |
|-----------|---------|
| Empty or whitespace only | "별칭을 입력해주세요" |
| Over 50 characters | "별칭은 50자 이내로 입력해주세요" |
| Normalized to empty | "유효한 문자를 포함한 별칭을 입력해주세요" |
| Same item duplicate | "이미 등록된 별칭입니다" |
| Same partner different item | "'{alias}'은(는) 다른 품목({item name})에 이미 사용 중입니다" |
| Over 5 limit | "별칭은 최대 5개까지 등록할 수 있습니다" |

### 4-4. Type Definitions

```typescript
interface PartnerProductAlias {
  id: number
  partner_product_id: number
  alias: string
  alias_normalized: string
  match_count: number
  last_matched_at: string | null
  created_at: string
}

// Extend existing PartnerProduct type
interface PartnerProduct {
  // ... existing fields
  aliases: Pick<PartnerProductAlias, 'id' | 'alias'>[]
}
```

## 5. Migration Plan

### 5-1. Single Migration File

`packages/supabase/migrations/00042_partner_product_aliases.sql`:

1. `normalize_alias()` 함수 생성
2. `partner_product_aliases` 테이블 생성 (CHECK 제약조건 포함)
3. UNIQUE 제약조건, B-tree/GIN 인덱스
4. 5개 제한 트리거 (BEFORE INSERT)
5. 업체 내 유니크 트리거 (BEFORE INSERT)
6. `updated_at` 트리거
7. RLS 정책 (permissive, 기존 패턴과 동일)

### 5-2. Safety

- 신규 테이블이므로 기존 데이터에 영향 없음
- `partner_products` 테이블 변경 없음
- 롤백: 테이블 및 함수 DROP만으로 완전 롤백 가능

### 5-3. Testing

마이그레이션에 한글 혼합 입력에 대한 `normalize_alias` 테스트 케이스 포함:
- `"투석 필터"` → `"투석필터"`
- `"FMC-필터(소)"` → `"fmc필터소"`
- `"---"` → `""` (CHECK 제약조건에 의해 거부)
