# MFDS 품목검색탭 UI/UX 재설계 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 638줄짜리 단일 MfdsSearchPanel을 통합 검색창 + 필터 칩 + 핵심 컬럼 테이블 + 아코디언 상세 구조로 재설계한다.

**Architecture:** 모놀리식 컴포넌트를 6개 하위 컴포넌트로 분리. 검색어 자동 판별 유틸리티로 통합 검색창 구현. 기존 서버 액션 (`searchMfdsDrug`/`searchMfdsDevice`)은 변경 없이 재사용.

**Tech Stack:** Next.js 16, React, TanStack Table, shadcn/ui (Tabs, Input, Button, Badge, DropdownMenu, Skeleton, Popover), Tailwind CSS, TypeScript

**Design doc:** `docs/plans/2026-02-26-mfds-search-redesign-design.md`

**Verification:** 프로젝트에 테스트 프레임워크 없음. TypeScript 컴파일(`npx tsc --noEmit`)과 dev 서버 시각 확인으로 검증.

---

## Task 1: 검색어 자동 판별 유틸리티

**Files:**
- Create: `apps/web/src/lib/mfds-search-utils.ts`

**Step 1: 타입 정의 및 판별 함수 작성**

```typescript
// apps/web/src/lib/mfds-search-utils.ts
import type { MfdsApiSource } from "@/lib/types";

export interface FilterChip {
  field: string;
  label: string;
  value: string;
}

export interface DetectedSearch {
  primary: Record<string, string>;
  fallback: Record<string, string> | null;
}

const KOREAN_RE = /[가-힣]/;
const DIGITS_ONLY_RE = /^\d{4,}$/;
const DIGITS_HYPHEN_RE = /^\d+[-]\d+/;
const ATC_LIKE_RE = /^[A-Za-z]\d{2}[A-Za-z]?/;
const ALPHA_ONLY_RE = /^[A-Za-z\s]+$/;

export function detectSearchFields(
  query: string,
  tab: MfdsApiSource,
): DetectedSearch {
  const q = query.trim();
  if (!q) return { primary: {}, fallback: null };

  if (tab === "drug") return detectDrug(q);
  return detectDevice(q);
}

function detectDrug(q: string): DetectedSearch {
  if (DIGITS_ONLY_RE.test(q)) {
    return {
      primary: { BAR_CODE: q },
      fallback: { ITEM_SEQ: q },
    };
  }
  if (DIGITS_HYPHEN_RE.test(q)) {
    return {
      primary: { EDI_CODE: q },
      fallback: { BAR_CODE: q },
    };
  }
  if (ATC_LIKE_RE.test(q) && !KOREAN_RE.test(q)) {
    return {
      primary: { ATC_CODE: q },
      fallback: null,
    };
  }
  if (KOREAN_RE.test(q)) {
    return {
      primary: { ITEM_NAME: q },
      fallback: { ENTP_NAME: q },
    };
  }
  if (ALPHA_ONLY_RE.test(q)) {
    return {
      primary: { ITEM_NAME: q },
      fallback: null,
    };
  }
  return { primary: { ITEM_NAME: q }, fallback: null };
}

function detectDevice(q: string): DetectedSearch {
  if (DIGITS_ONLY_RE.test(q)) {
    return {
      primary: { UDIDI_CD: q },
      fallback: { PERMIT_NO: q },
    };
  }
  if (DIGITS_HYPHEN_RE.test(q)) {
    return {
      primary: { PERMIT_NO: q },
      fallback: { MDEQ_CLSF_NO: q },
    };
  }
  if (KOREAN_RE.test(q)) {
    return {
      primary: { PRDLST_NM: q },
      fallback: { MNFT_IPRT_ENTP_NM: q },
    };
  }
  if (ALPHA_ONLY_RE.test(q)) {
    return {
      primary: { FOML_INFO: q },
      fallback: null,
    };
  }
  return { primary: { PRDLST_NM: q }, fallback: null };
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add apps/web/src/lib/mfds-search-utils.ts
git commit -m "feat(mfds): add smart search query detection utility"
```

---

## Task 2: 최근 검색어 훅

**Files:**
- Create: `apps/web/src/hooks/use-recent-searches.ts`

**Step 1: localStorage 기반 최근 검색 훅 작성**

```typescript
// apps/web/src/hooks/use-recent-searches.ts
"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "mfds-recent-searches";
const MAX_ITEMS = 5;

export interface RecentSearch {
  query: string;
  tab: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const add = useCallback((query: string, tab: string) => {
    setItems((prev) => {
      const filtered = prev.filter((s) => !(s.query === query && s.tab === tab));
      const next = [{ query, tab, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  }, []);

  return { items, add, clear };
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add apps/web/src/hooks/use-recent-searches.ts
git commit -m "feat(mfds): add useRecentSearches hook with localStorage"
```

---

## Task 3: MfdsSearchBar 컴포넌트 (통합 검색 + 세그먼트 토글 + 필터 칩)

**Files:**
- Create: `apps/web/src/components/mfds/mfds-search-bar.tsx`

**Dependencies:** Task 1의 `FilterChip` 타입, shadcn/ui `Input`, `Button`, `Badge`, `Tabs`, `DropdownMenu`, `Popover`

**Step 1: 컴포넌트 작성**

```tsx
// apps/web/src/components/mfds/mfds-search-bar.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Search, Loader2, Plus, X, Clock } from "lucide-react";
import type { MfdsApiSource } from "@/lib/types";
import type { FilterChip } from "@/lib/mfds-search-utils";
import type { RecentSearch } from "@/hooks/use-recent-searches";

// --- 탭별 필터 추가 메뉴 항목 ---

const DRUG_FILTER_OPTIONS = [
  { field: "ENTP_NAME", label: "업체명" },
  { field: "BAR_CODE", label: "표준코드" },
  { field: "EDI_CODE", label: "보험코드" },
  { field: "ATC_CODE", label: "ATC코드" },
  { field: "ITEM_PERMIT_DATE", label: "허가일자" },
];

const DEVICE_FILTER_OPTIONS = [
  { field: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { field: "UDIDI_CD", label: "UDI-DI코드" },
  { field: "MDEQ_CLSF_NO", label: "분류번호" },
  { field: "CLSF_NO_GRAD_CD", label: "등급" },
  { field: "PERMIT_NO", label: "품목허가번호" },
  { field: "FOML_INFO", label: "모델명" },
];

interface MfdsSearchBarProps {
  tab: MfdsApiSource;
  onTabChange: (tab: MfdsApiSource) => void;
  query: string;
  onQueryChange: (q: string) => void;
  activeFilters: FilterChip[];
  onFiltersChange: (filters: FilterChip[]) => void;
  onSearch: () => void;
  isPending: boolean;
  recentSearches: RecentSearch[];
  onRecentClick: (item: RecentSearch) => void;
  hasSearched: boolean;
}

export function MfdsSearchBar({
  tab,
  onTabChange,
  query,
  onQueryChange,
  activeFilters,
  onFiltersChange,
  onSearch,
  isPending,
  recentSearches,
  onRecentClick,
  hasSearched,
}: MfdsSearchBarProps) {
  const [addingFilter, setAddingFilter] = useState<{
    field: string;
    label: string;
  } | null>(null);
  const [filterValue, setFilterValue] = useState("");

  const filterOptions =
    tab === "drug" ? DRUG_FILTER_OPTIONS : DEVICE_FILTER_OPTIONS;

  // 이미 추가된 필터는 메뉴에서 제외
  const availableFilters = filterOptions.filter(
    (opt) => !activeFilters.some((f) => f.field === opt.field),
  );

  function handleRemoveFilter(field: string) {
    onFiltersChange(activeFilters.filter((f) => f.field !== field));
  }

  function handleAddFilter() {
    if (!addingFilter || !filterValue.trim()) return;
    onFiltersChange([
      ...activeFilters,
      { field: addingFilter.field, label: addingFilter.label, value: filterValue.trim() },
    ]);
    setAddingFilter(null);
    setFilterValue("");
  }

  function handleCancelAdd() {
    setAddingFilter(null);
    setFilterValue("");
  }

  return (
    <div className="space-y-3">
      {/* 세그먼트 토글 */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "drug"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onTabChange("drug")}
        >
          의약품
        </button>
        <button
          type="button"
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "device_std"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onTabChange("device_std")}
        >
          의료기기
        </button>
      </div>

      {/* 통합 검색창 */}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="품목명, 업체명, 코드로 검색..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-10 h-11 text-base"
          />
          {query && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={() => onQueryChange("")}
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={isPending} className="h-11 px-6">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">검색</span>
        </Button>
      </form>

      {/* 필터 칩 영역 */}
      <div className="flex items-center gap-2 flex-wrap">
        {activeFilters.map((chip) => (
          <Badge
            key={chip.field}
            variant="secondary"
            className="gap-1 pl-2 pr-1 py-1"
          >
            <span className="text-xs text-muted-foreground">{chip.label}:</span>
            <span className="text-xs font-medium">{chip.value}</span>
            <button
              type="button"
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              onClick={() => handleRemoveFilter(chip.field)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* 필터 추가 중 — 인라인 입력 */}
        {addingFilter && (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="gap-1 py-1">
              <span className="text-xs">{addingFilter.label}:</span>
              <Input
                autoFocus
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddFilter();
                  }
                  if (e.key === "Escape") handleCancelAdd();
                }}
                className="h-5 w-28 border-0 p-0 text-xs focus-visible:ring-0"
                placeholder="값 입력..."
              />
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCancelAdd}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* 필터 추가 버튼 */}
        {!addingFilter && availableFilters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                필터 추가
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableFilters.map((opt) => (
                <DropdownMenuItem
                  key={opt.field}
                  onClick={() => setAddingFilter(opt)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 최근 검색어 (검색 전 초기 상태에서만) */}
      {!hasSearched && recentSearches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            최근:
          </span>
          {recentSearches.map((item, i) => (
            <button
              key={`${item.query}-${i}`}
              type="button"
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => onRecentClick(item)}
            >
              {item.query}
              <span className="ml-1 text-muted-foreground">
                ({item.tab === "drug" ? "약" : "기기"})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-search-bar.tsx
git commit -m "feat(mfds): add MfdsSearchBar with unified search, segment toggle, filter chips"
```

---

## Task 4: MfdsRowDetail 컴포넌트 (아코디언 확장 패널)

**Files:**
- Create: `apps/web/src/components/mfds/mfds-row-detail.tsx`

**Step 1: 의약품/의료기기 분기 상세 패널 작성**

```tsx
// apps/web/src/components/mfds/mfds-row-detail.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check } from "lucide-react";
import type { MfdsApiSource } from "@/lib/types";

// 아코디언 상세 영역에 표시할 필드 그룹
const DRUG_DETAIL_GROUPS = [
  {
    title: "기본 정보",
    fields: [
      { key: "ITEM_ENG_NAME", label: "품목영문명" },
      { key: "CNSGN_MANUF", label: "위탁제조업체" },
      { key: "PACK_UNIT", label: "포장단위" },
      { key: "ATC_CODE", label: "ATC코드" },
      { key: "ENTP_NO", label: "업체허가번호" },
    ],
  },
  {
    title: "허가/분류",
    fields: [
      { key: "PERMIT_KIND_NAME", label: "허가/신고구분" },
      { key: "CHANGE_DATE", label: "변경일자" },
      { key: "CANCEL_DATE", label: "취소일자" },
      { key: "RARE_DRUG_YN", label: "희귀의약품" },
    ],
  },
  {
    title: "상세 정보",
    fields: [
      { key: "CHART", label: "성상" },
      { key: "STORAGE_METHOD", label: "저장방법" },
      { key: "VALID_TERM", label: "유효기간" },
      { key: "EE_DOC_ID", label: "효능효과" },
      { key: "UD_DOC_ID", label: "용법용량" },
      { key: "NB_DOC_ID", label: "주의사항" },
    ],
  },
];

const DEVICE_DETAIL_GROUPS = [
  {
    title: "기본 정보",
    fields: [
      { key: "PRDT_NM_INFO", label: "제품명" },
      { key: "MDEQ_CLSF_NO", label: "분류번호" },
      { key: "USE_PURPS_CONT", label: "사용목적" },
    ],
  },
  {
    title: "관리 구분",
    fields: [
      { key: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부" },
      { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상여부" },
      { key: "TOTAL_DEV", label: "한벌구성의료기기여부" },
      { key: "CMBNMD_YN", label: "조합의료기기여부" },
      { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상여부" },
    ],
  },
  {
    title: "보관/멸균",
    fields: [
      { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사용전멸균필요여부" },
      { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
      { key: "STRG_CND_INFO", label: "저장조건" },
      { key: "CIRC_CND_INFO", label: "유통취급조건" },
    ],
  },
];

interface MfdsRowDetailProps {
  item: Record<string, unknown>;
  tab: MfdsApiSource;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
  colSpan: number;
}

export function MfdsRowDetail({
  item,
  tab,
  isAdded,
  isAdding,
  onAdd,
  colSpan,
}: MfdsRowDetailProps) {
  const groups = tab === "drug" ? DRUG_DETAIL_GROUPS : DEVICE_DETAIL_GROUPS;

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-muted/20 border-t px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </h4>
                <dl className="space-y-1">
                  {group.fields.map(({ key, label }) => {
                    const val = (item[key] as string) ?? "";
                    if (!val) return null;
                    return (
                      <div key={key} className="flex gap-2 text-sm">
                        <dt className="text-muted-foreground shrink-0 w-24 text-right">
                          {label}
                        </dt>
                        <dd className="break-words min-w-0">{val}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>

          {/* 추가 버튼 */}
          <div className="flex justify-end pt-2 border-t">
            {isAdded ? (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                추가됨
              </Badge>
            ) : (
              <Button size="sm" disabled={isAdding} onClick={onAdd}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                내 품목에 추가
              </Button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-row-detail.tsx
git commit -m "feat(mfds): add MfdsRowDetail accordion expansion panel"
```

---

## Task 5: MfdsPagination 컴포넌트

**Files:**
- Create: `apps/web/src/components/mfds/mfds-pagination.tsx`

**Step 1: 페이지 번호 직접 클릭 가능한 페이지네이션 작성**

```tsx
// apps/web/src/components/mfds/mfds-pagination.tsx
"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MfdsPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  isPending: boolean;
  onPageChange: (page: number) => void;
}

export function MfdsPagination({
  page,
  totalPages,
  totalCount,
  isPending,
  onPageChange,
}: MfdsPaginationProps) {
  if (totalPages <= 1) return null;

  // 표시할 페이지 번호 계산 (최대 5개 + 말줄임)
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [];
    if (page <= 3) {
      pages.push(1, 2, 3, 4, "ellipsis", totalPages);
    } else if (page >= totalPages - 2) {
      pages.push(1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages);
    }
    return pages;
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-sm text-muted-foreground mr-2">
        총 {totalCount.toLocaleString()}건
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page <= 1 || isPending}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {getPageNumbers().map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-8 w-8 text-xs"
            disabled={isPending}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page >= totalPages || isPending}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`

**Step 3: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-pagination.tsx
git commit -m "feat(mfds): add MfdsPagination with page number buttons"
```

---

## Task 6: MfdsResultToolbar 컴포넌트

**Files:**
- Create: `apps/web/src/components/mfds/mfds-result-toolbar.tsx`

**Step 1: 결과 요약 + 결과 내 검색 + 컬럼 설정 바 작성**

```tsx
// apps/web/src/components/mfds/mfds-result-toolbar.tsx
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Filter, Settings2, X } from "lucide-react";
import type { Table } from "@tanstack/react-table";

interface MfdsResultToolbarProps {
  totalCount: number;
  page: number;
  totalPages: number;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  filteredCount: number;
  table: Table<Record<string, unknown>>;
}

export function MfdsResultToolbar({
  totalCount,
  page,
  totalPages,
  globalFilter,
  onGlobalFilterChange,
  filteredCount,
  table,
}: MfdsResultToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <p className="text-sm text-muted-foreground">
        총 {totalCount.toLocaleString()}건 (페이지 {page}/{totalPages || 1})
        {globalFilter && (
          <span className="ml-2">· 필터 적용: {filteredCount}건 표시</span>
        )}
      </p>
      <div className="flex items-center gap-2">
        {/* 결과 내 검색 */}
        <div className="relative">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="결과 내 검색..."
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="pl-7 h-8 w-48 text-xs"
          />
          {globalFilter && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => onGlobalFilterChange("")}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* 컬럼 표시 설정 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Settings2 className="h-3 w-3 mr-1" />
              컬럼
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>표시할 컬럼</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((col) => col.id !== "_action" && col.id !== "_expand")
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v: boolean) => col.toggleVisibility(v)}
                >
                  {typeof col.columnDef.header === "string"
                    ? col.columnDef.header
                    : col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`

**Step 3: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-result-toolbar.tsx
git commit -m "feat(mfds): add MfdsResultToolbar with global filter and column toggle"
```

---

## Task 7: MfdsResultTable 컴포넌트 (테이블 + 아코디언 통합)

**Files:**
- Create: `apps/web/src/components/mfds/mfds-result-table.tsx`

**Dependencies:** Task 4의 `MfdsRowDetail`

이 컴포넌트는 가장 큰 컴포넌트. TanStack Table 인스턴스를 받아서 핵심 컬럼 테이블 + 행 클릭 아코디언을 렌더링한다.

**Step 1: 테이블 렌더링 + 아코디언 토글 작성**

```tsx
// apps/web/src/components/mfds/mfds-result-table.tsx
"use client";

import { flexRender, type Table as TanTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MfdsRowDetail } from "./mfds-row-detail";
import type { MfdsApiSource } from "@/lib/types";

interface MfdsResultTableProps {
  table: TanTable<Record<string, unknown>>;
  tab: MfdsApiSource;
  expandedRowId: string | null;
  onExpandToggle: (rowId: string) => void;
  existingStandardCodes: string[];
  addingId: string | null;
  onAdd: (item: Record<string, unknown>) => void;
  isPending: boolean;
  isLoading: boolean;
  hasSearched: boolean;
}

function getStandardCode(
  item: Record<string, unknown>,
  tab: MfdsApiSource,
): string {
  return ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
}

export function MfdsResultTable({
  table,
  tab,
  expandedRowId,
  onExpandToggle,
  existingStandardCodes,
  addingId,
  onAdd,
  isPending,
  isLoading,
  hasSearched,
}: MfdsResultTableProps) {
  const colSpan = table.getVisibleLeafColumns().length;

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <div className="border rounded-md p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // 빈 상태
  if (hasSearched && table.getRowModel().rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>검색 결과가 없습니다.</p>
        <p className="text-xs mt-1">다른 검색어를 시도하거나, 필터를 줄여보세요.</p>
      </div>
    );
  }

  if (!hasSearched) return null;

  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isAction = header.id === "_action";
                const isExpand = header.id === "_expand";
                return (
                  <th
                    key={header.id}
                    className={`relative px-3 py-2 text-left whitespace-nowrap select-none ${
                      isAction || isExpand
                        ? "w-12"
                        : ""
                    }`}
                    style={
                      !isAction && !isExpand
                        ? { width: header.getSize() }
                        : undefined
                    }
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        header.column.getCanSort()
                          ? "cursor-pointer hover:text-foreground"
                          : ""
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc" && (
                        <ArrowUp className="h-3 w-3 flex-shrink-0" />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ArrowDown className="h-3 w-3 flex-shrink-0" />
                      )}
                      {header.column.getCanSort() &&
                        !header.column.getIsSorted() && (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                        )}
                    </div>
                    {/* 리사이즈 핸들 */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-primary/50 ${
                          header.column.getIsResizing() ? "bg-primary" : ""
                        }`}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map((row) => {
            const isExpanded = expandedRowId === row.id;
            const item = row.original;
            const code = getStandardCode(item, tab);
            const isAdded = existingStandardCodes.includes(code);
            const isAdding = isPending && addingId === code;

            return (
              <>
                <tr
                  key={row.id}
                  className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                    isExpanded ? "bg-muted/20" : ""
                  }`}
                  onClick={() => onExpandToggle(row.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate"
                      style={
                        cell.column.id !== "_action" && cell.column.id !== "_expand"
                          ? { width: cell.column.getSize() }
                          : undefined
                      }
                      onClick={
                        cell.column.id === "_action"
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <MfdsRowDetail
                    key={`detail-${row.id}`}
                    item={item}
                    tab={tab}
                    isAdded={isAdded}
                    isAdding={isAdding}
                    onAdd={() => onAdd(item)}
                    colSpan={colSpan}
                  />
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`

**Step 3: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-result-table.tsx
git commit -m "feat(mfds): add MfdsResultTable with accordion row expansion"
```

---

## Task 8: MfdsSearchPanel 재작성 (조합 컨테이너)

**Files:**
- Modify: `apps/web/src/components/mfds-search-panel.tsx` (전체 재작성)

이 태스크는 기존 638줄 컴포넌트를 새 하위 컴포넌트들을 조합하는 ~200줄 컨테이너로 교체한다.

**Step 1: 기존 파일을 백업하고 새 내용으로 교체**

기존 `mfds-search-panel.tsx` 전체를 다음으로 교체:

```tsx
// apps/web/src/components/mfds-search-panel.tsx
"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { searchMfdsDrug, searchMfdsDevice, addMfdsItemToProducts } from "@/lib/actions";
import { detectSearchFields, type FilterChip } from "@/lib/mfds-search-utils";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { MfdsSearchBar } from "@/components/mfds/mfds-search-bar";
import { MfdsResultToolbar } from "@/components/mfds/mfds-result-toolbar";
import { MfdsResultTable } from "@/components/mfds/mfds-result-table";
import { MfdsPagination } from "@/components/mfds/mfds-pagination";
import type { MfdsApiSource } from "@/lib/types";

// ─── Column Defs (기본 노출 컬럼) ────────────────────────────────

interface MfdsCol { key: string; label: string }

const DRUG_DEFAULT_COLS: MfdsCol[] = [
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "ETC_OTC_CODE", label: "전문/일반" },
  { key: "BAR_CODE", label: "표준코드" },
  { key: "EDI_CODE", label: "보험코드" },
  { key: "ITEM_PERMIT_DATE", label: "허가일자" },
  { key: "MATERIAL_NAME", label: "성분" },
  { key: "CANCEL_NAME", label: "상태" },
];

const DEVICE_DEFAULT_COLS: MfdsCol[] = [
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "UDIDI_CD", label: "UDI-DI코드" },
  { key: "PERMIT_NO", label: "품목허가번호" },
  { key: "PRMSN_YMD", label: "허가일자" },
  { key: "FOML_INFO", label: "모델명" },
  { key: "DSPSBL_MDEQ_YN", label: "일회용여부" },
];

// ─── Props ───────────────────────────────────────────────────────

interface MfdsSearchPanelProps {
  mode: "browse" | "pick";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
}

// ─── Component ───────────────────────────────────────────────────

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
}: MfdsSearchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const recentSearches = useRecentSearches();

  // Search state
  const [tab, setTab] = useState<MfdsApiSource>("drug");
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  // Results state
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // Accordion state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const colDefs = tab === "drug" ? DRUG_DEFAULT_COLS : DEVICE_DEFAULT_COLS;
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);

  function getStandardCode(item: Record<string, unknown>): string {
    return ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
  }

  // ── TanStack column defs ──────────────────────────────────────

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const expandCol: ColumnDef<Record<string, unknown>> = {
      id: "_expand",
      header: "",
      size: 40,
      enableResizing: false,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const isExpanded = expandedRowId === row.id;
        return isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        );
      },
    };

    const actionCol: ColumnDef<Record<string, unknown>> = {
      id: "_action",
      header: mode === "browse" ? "추가" : "선택",
      size: 70,
      enableResizing: false,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const item = row.original;
        const code = getStandardCode(item);
        const alreadyAdded = existingStandardCodes.includes(code);
        if (alreadyAdded) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3" /> 추가됨
            </span>
          );
        }
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={isPending && addingId === code}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd(item);
            }}
          >
            {isPending && addingId === code ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        );
      },
    };

    const dataCols: ColumnDef<Record<string, unknown>>[] = colDefs.map((col) => ({
      id: col.key,
      accessorFn: (row: Record<string, unknown>) => (row[col.key] as string) ?? "",
      header: col.label,
      size: col.key.includes("NAME") || col.key.includes("NM") ? 200 : 120,
      minSize: 60,
      enableResizing: true,
    }));

    return [expandCol, ...dataCols, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colDefs, mode, existingStandardCodes, isPending, addingId, tab, expandedRowId]);

  // ── Table instance ────────────────────────────────────────────

  const table = useReactTable({
    data: results,
    columns,
    state: { sorting, columnVisibility, globalFilter, columnSizing },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  // ── Handlers ──────────────────────────────────────────────────

  async function executeSearch(targetPage: number, filters: Record<string, string>) {
    const searchFn = tab === "drug" ? searchMfdsDrug : searchMfdsDevice;
    const result = await searchFn(filters, targetPage);
    return result;
  }

  function doSearch(targetPage = 1) {
    // 통합 검색어 → 자동 판별 필드 + 필터 칩 필드 합성
    const chipFilters: Record<string, string> = {};
    for (const chip of activeFilters) {
      chipFilters[chip.field] = chip.value;
    }

    const detected = detectSearchFields(query, tab);
    const mergedPrimary = { ...detected.primary, ...chipFilters };

    if (Object.keys(mergedPrimary).length === 0 && !query.trim()) {
      toast.error("검색어를 입력하거나 필터를 추가해주세요.");
      return;
    }

    setIsLoading(true);
    startTransition(async () => {
      try {
        let result = await executeSearch(targetPage, mergedPrimary);

        // 결과 0건 + fallback 필드 있으면 재시도
        if (result.totalCount === 0 && detected.fallback) {
          const mergedFallback = { ...detected.fallback, ...chipFilters };
          result = await executeSearch(targetPage, mergedFallback);
        }

        setResults(result.items as Record<string, unknown>[]);
        setTotalCount(result.totalCount);
        setPage(targetPage);
        setHasSearched(true);
        setExpandedRowId(null);

        if (query.trim()) {
          recentSearches.add(query.trim(), tab);
        }
      } catch (err) {
        toast.error(
          `검색 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        );
      } finally {
        setIsLoading(false);
      }
    });
  }

  function handleAdd(item: Record<string, unknown>) {
    const code = getStandardCode(item);
    setAddingId(code);
    startTransition(async () => {
      try {
        const result = await addMfdsItemToProducts(item, tab);
        if (result.alreadyExists) {
          toast.info("이미 내 품목에 등록된 항목입니다.");
        } else {
          toast("내 품목에 추가되었습니다.", {
            action: {
              label: "내 품목 보기 →",
              onClick: () => router.push("/products/my"),
            },
          });
        }
        if (mode === "pick" && onSelect) {
          onSelect(result.id);
        }
        router.refresh();
      } catch (err) {
        toast.error(
          `추가 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        );
      } finally {
        setAddingId(null);
      }
    });
  }

  function handleTabChange(newTab: MfdsApiSource) {
    setTab(newTab);
    setActiveFilters([]);
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setHasSearched(false);
    setSorting([]);
    setColumnVisibility({});
    setGlobalFilter("");
    setColumnSizing({});
    setExpandedRowId(null);
    // query는 유지
  }

  function handleExpandToggle(rowId: string) {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId));
  }

  function handleRecentClick(item: { query: string; tab: string }) {
    setQuery(item.query);
    if (item.tab !== tab) {
      handleTabChange(item.tab as MfdsApiSource);
    }
    // 다음 틱에서 검색 실행 (state 업데이트 후)
    setTimeout(() => doSearch(1), 0);
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <MfdsSearchBar
        tab={tab}
        onTabChange={handleTabChange}
        query={query}
        onQueryChange={setQuery}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
        onSearch={() => doSearch(1)}
        isPending={isPending || isLoading}
        recentSearches={recentSearches.items}
        onRecentClick={handleRecentClick}
        hasSearched={hasSearched}
      />

      {hasSearched && !isLoading && (
        <MfdsResultToolbar
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          filteredCount={table.getFilteredRowModel().rows.length}
          table={table}
        />
      )}

      <MfdsResultTable
        table={table}
        tab={tab}
        expandedRowId={expandedRowId}
        onExpandToggle={handleExpandToggle}
        existingStandardCodes={existingStandardCodes}
        addingId={addingId}
        onAdd={handleAdd}
        isPending={isPending}
        isLoading={isLoading}
        hasSearched={hasSearched}
      />

      <MfdsPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        isPending={isPending || isLoading}
        onPageChange={(p) => doSearch(p)}
      />
    </div>
  );
}
```

**Step 2: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

**Step 3: dev 서버 실행 후 `/products` 페이지 시각 확인**

Run: `cd apps/web && npm run dev`
확인 사항:
- 세그먼트 토글 (의약품/의료기기) 동작
- 통합 검색창에 품목명 입력 후 검색 동작
- 결과 테이블 9개 핵심 컬럼 표시
- 행 클릭 시 아코디언 확장
- 필터 칩 추가/제거 동작
- 페이지네이션 번호 클릭
- 최근 검색어 표시 및 클릭
- 품목 추가 시 토스트 + "내 품목 보기" 링크

**Step 4: 커밋**

```bash
git add apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat(mfds): rewrite MfdsSearchPanel with smart search, filter chips, accordion"
```

---

## Task 9: 모바일 반응형 (카드 뷰)

**Files:**
- Create: `apps/web/src/components/mfds/mfds-mobile-card.tsx`
- Modify: `apps/web/src/components/mfds/mfds-result-table.tsx` — 768px 이하 카드 뷰 분기 추가

**Step 1: 모바일 카드 컴포넌트 작성**

```tsx
// apps/web/src/components/mfds/mfds-mobile-card.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { MfdsRowDetail } from "./mfds-row-detail";
import type { MfdsApiSource } from "@/lib/types";

interface MfdsMobileCardProps {
  item: Record<string, unknown>;
  tab: MfdsApiSource;
  isExpanded: boolean;
  onToggle: () => void;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
}

export function MfdsMobileCard({
  item,
  tab,
  isExpanded,
  onToggle,
  isAdded,
  isAdding,
  onAdd,
}: MfdsMobileCardProps) {
  const name = (tab === "drug" ? item.ITEM_NAME : item.PRDLST_NM) as string ?? "";
  const company = (tab === "drug" ? item.ENTP_NAME : item.MNFT_IPRT_ENTP_NM) as string ?? "";
  const code = (tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string ?? "";
  const status = tab === "drug" ? (item.CANCEL_NAME as string ?? "") : (item.CLSF_NO_GRAD_CD as string ?? "");

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{company}</p>
          {code && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{code}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <Badge variant="outline" className="text-xs">{status}</Badge>
          )}
          {isAdded ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3" /> 추가됨
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={isAdding}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              {isAdding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t">
          <MfdsRowDetail
            item={item}
            tab={tab}
            isAdded={isAdded}
            isAdding={isAdding}
            onAdd={onAdd}
            colSpan={1}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: MfdsResultTable에 모바일 분기 추가**

`apps/web/src/components/mfds/mfds-result-table.tsx` 에 다음 변경:
- `MfdsMobileCard` import 추가
- `useMediaQuery` 또는 CSS `md:hidden` / `hidden md:block` 클래스로 분기
- 가장 단순한 방법: Tailwind의 반응형 클래스로 테이블/카드 각각 표시

테이블 컴포넌트 내 return문에서 데스크톱 테이블은 `hidden md:block`, 모바일 카드는 `md:hidden`으로 분기한다.

수정 내용 — `MfdsResultTable` 컴포넌트의 return문 변경:
- 빈 상태/로딩 상태 후, 테이블 렌더링 직전에 모바일 카드 목록을 추가
- 기존 `<div className="border rounded-md overflow-x-auto">` → `<div className="border rounded-md overflow-x-auto hidden md:block">`
- 카드 목록: `<div className="space-y-2 md:hidden">`

**Step 3: 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`

**Step 4: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-mobile-card.tsx apps/web/src/components/mfds/mfds-result-table.tsx
git commit -m "feat(mfds): add mobile card view for search results under 768px"
```

---

## Task 10: 키보드 접근성

**Files:**
- Modify: `apps/web/src/components/mfds/mfds-result-table.tsx` — Escape로 아코디언 닫기

**Step 1: 키보드 이벤트 핸들러 추가**

`MfdsResultTable` 컴포넌트에 `onKeyDown` 핸들러 추가:
- 테이블 wrapper div에 `tabIndex={0}` 추가
- `Escape` → `onExpandToggle("")` (아코디언 닫기)

**Step 2: 컴파일 확인 & 시각 확인**

**Step 3: 커밋**

```bash
git add apps/web/src/components/mfds/mfds-result-table.tsx
git commit -m "feat(mfds): add keyboard accessibility for accordion toggle"
```

---

## Task 11: 정리 및 최종 확인

**Files:**
- 확인: 모든 신규/수정 파일 TypeScript 에러 없음
- 삭제: 없음 (기존 파일은 제자리에서 교체됨)

**Step 1: 전체 컴파일 확인**

Run: `cd apps/web && npx tsc --noEmit`

**Step 2: dev 서버 전체 동작 확인**

확인 체크리스트:
- [ ] 의약품 품목명 검색 → 결과 테이블 (9개 컬럼)
- [ ] 의료기기 탭 전환 → 검색어 유지, 결과 리셋
- [ ] 숫자 코드 입력 → 표준코드/UDI-DI로 자동 판별
- [ ] 필터 칩 추가/제거 동작
- [ ] 행 클릭 → 아코디언 확장/축소
- [ ] 아코디언 내 "내 품목에 추가" 버튼
- [ ] 추가 완료 토스트 + "내 품목 보기" 링크
- [ ] 페이지네이션 번호 클릭
- [ ] 결과 내 검색 동작
- [ ] 컬럼 표시 설정 동작
- [ ] 최근 검색어 표시 및 클릭
- [ ] 모바일 뷰포트 (< 768px) → 카드 리스트
- [ ] Escape 키로 아코디언 닫기

**Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat(mfds): complete search tab UI/UX redesign"
```

---

## File Summary

| 파일 | 상태 | 설명 |
|------|------|------|
| `apps/web/src/lib/mfds-search-utils.ts` | 신규 | 검색어 자동 판별 유틸리티 |
| `apps/web/src/hooks/use-recent-searches.ts` | 신규 | localStorage 최근 검색어 훅 |
| `apps/web/src/components/mfds/mfds-search-bar.tsx` | 신규 | 통합 검색창 + 세그먼트 토글 + 필터 칩 |
| `apps/web/src/components/mfds/mfds-row-detail.tsx` | 신규 | 아코디언 확장 상세 패널 |
| `apps/web/src/components/mfds/mfds-pagination.tsx` | 신규 | 페이지 번호 페이지네이션 |
| `apps/web/src/components/mfds/mfds-result-toolbar.tsx` | 신규 | 결과 요약 + 결과 내 검색 + 컬럼 설정 |
| `apps/web/src/components/mfds/mfds-result-table.tsx` | 신규 | TanStack 테이블 + 아코디언 + 모바일 카드 분기 |
| `apps/web/src/components/mfds/mfds-mobile-card.tsx` | 신규 | 모바일 카드 뷰 |
| `apps/web/src/components/mfds-search-panel.tsx` | 교체 | 638줄 → ~200줄 조합 컨테이너 |
