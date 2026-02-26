# 식약처 의약품 API 연동 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 식품의약품안전처 의약품 제품 허가정보 API를 연동하여, 품목 관리와 주문 테이블에서 실시간으로 의약품을 검색하고 자동으로 품목을 생성할 수 있게 한다.

**Architecture:** Next.js API Route가 식약처 API를 프록시하여 클라이언트에서 안전하게 호출. DrugSearchDialog 공통 컴포넌트로 검색 결과를 표시하고, 선택 시 products 테이블에 자동 생성 후 폼/주문에 연결. API 키는 settings DB 테이블에 저장(AI 키와 동일 패턴).

**Tech Stack:** Next.js 16 App Router, Supabase, shadcn/ui, 공공데이터포털 REST API

---

## API 정보 요약

- **Endpoint:** `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07`
- **상세정보 조회:** `/getDrugPrdtPrmsnDtlInq06` (품목명, 업체명, 보험코드, 바코드, 주성분 등)
- **주성분 상세:** `/getDrugPrdtMcpnDtlInq07`
- **응답형식:** JSON (`type=json`)
- **일일 트래픽:** 각 10,000건
- **인증키 저장:** settings 테이블 key=`drug_api_service_key`

## DB 필드 매핑 (API → products)

| API 필드 | products 컬럼 | 비고 |
|---|---|---|
| item_name | official_name, name | 품목명 |
| entp_name | manufacturer | 업체명(제조사) |
| edi_code | standard_code | 보험코드 |
| main_item_ingr | ingredient | 주성분 |
| item_seq | auto_info.item_seq | 품목기준코드 |
| bar_code | auto_info.bar_code | 표준코드/바코드 |
| atc_code | auto_info.atc_code | ATC코드 |
| item_permit_date | auto_info.item_permit_date | 허가일자 |
| entp_no | auto_info.entp_no | 업체허가번호 |
| rare_drug_yn | auto_info.rare_drug_yn | 희귀의약품여부 |
| bizrno | auto_info.bizrno | 사업자등록번호 |
| — | category = 'medication' | 자동 설정 |

---

### Task 1: 타입 정의 추가

**Files:**
- Modify: `apps/web/src/lib/types.ts`

**Step 1: types.ts에 DrugSearchResult 인터페이스 추가**

파일 끝(`MessageCalendarItem` 타입 뒤)에 추가:

```typescript
// --- Drug API (식약처 의약품 허가정보) ---

export interface DrugSearchResult {
  item_seq: string;           // 품목기준코드
  item_name: string;          // 품목명
  entp_name: string;          // 업체명
  entp_no: string;            // 업체허가번호
  item_permit_date: string;   // 허가일자
  edi_code: string | null;    // 보험코드
  atc_code: string | null;    // ATC코드
  main_item_ingr: string | null; // 주성분
  bar_code: string | null;    // 표준코드/바코드
  bizrno: string | null;      // 사업자등록번호
  rare_drug_yn: string | null; // 희귀의약품여부
}

export interface DrugSearchResponse {
  items: DrugSearchResult[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(types): add DrugSearchResult and DrugSearchResponse interfaces"
```

---

### Task 2: Settings 연동 — API 키 저장/조회

**Files:**
- Modify: `apps/web/src/lib/queries/settings.ts`
- Modify: `apps/web/src/components/ai-settings.tsx`

**Step 1: settings.ts에 drug API 키 조회 추가**

`getSettings()` 함수에서:
1. `.in("key", [...])` 배열에 `"drug_api_service_key"` 추가
2. `AISettings` 인터페이스에 `drug_api_key: AIApiKeyInfo` 추가
3. return 객체에 `drug_api_key: maskApiKey(map.get("drug_api_service_key"))` 추가

```typescript
// AISettings 인터페이스에 추가:
export interface AISettings {
  // ... 기존 필드 ...
  drug_api_key: AIApiKeyInfo;
}

// getSettings() 내부 .in() 배열에 추가:
"drug_api_service_key",

// return 객체에 추가:
drug_api_key: maskApiKey(map.get("drug_api_service_key")),
```

**Step 2: ai-settings.tsx에 의약품 API 키 카드 추가**

`AISettingsForm` 컴포넌트에 새 Card 섹션 추가 (기존 "API 키" 카드 아래).
별도의 state 관리: `drugApiKey`, `showDrugKey`, `isSavingDrugKey`.

```typescript
// state 추가
const [drugApiKey, setDrugApiKey] = useState("");
const [showDrugKey, setShowDrugKey] = useState(false);
const [isSavingDrugKey, setIsSavingDrugKey] = useState(false);

async function handleSaveDrugApiKey() {
  if (!drugApiKey.trim()) {
    toast.error("API 키를 입력하세요.");
    return;
  }
  setIsSavingDrugKey(true);
  try {
    await updateSettingAction("drug_api_service_key", drugApiKey.trim());
    toast.success("의약품 API 키가 저장되었습니다.");
    setDrugApiKey("");
    setShowDrugKey(false);
    router.refresh();
  } catch {
    toast.error("API 키 저장에 실패했습니다.");
  } finally {
    setIsSavingDrugKey(false);
  }
}

async function handleDeleteDrugApiKey() {
  setIsSavingDrugKey(true);
  try {
    await updateSettingAction("drug_api_service_key", "");
    toast.success("의약품 API 키가 삭제되었습니다.");
    router.refresh();
  } catch {
    toast.error("API 키 삭제에 실패했습니다.");
  } finally {
    setIsSavingDrugKey(false);
  }
}
```

JSX — 기존 마지막 Card 전에 삽입 (Test Parse 카드 위):

```tsx
{/* Drug API Key */}
<Card>
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <Key className="h-4 w-4" />
      의약품 API 키
    </CardTitle>
    <CardDescription>
      공공데이터포털에서 발급받은 식약처 의약품 허가정보 API 인증키를 입력합니다.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    {settings.drug_api_key?.set && (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          등록됨
        </Badge>
        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {settings.drug_api_key.masked}
        </code>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive h-6 px-2 text-xs"
          disabled={isSavingDrugKey}
          onClick={handleDeleteDrugApiKey}
        >
          삭제
        </Button>
      </div>
    )}
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          type={showDrugKey ? "text" : "password"}
          value={drugApiKey}
          onChange={(e) => setDrugApiKey(e.target.value)}
          placeholder={settings.drug_api_key?.set
            ? "새 키로 변경하려면 입력..."
            : "공공데이터포털 인증키 입력..."}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-10"
          onClick={() => setShowDrugKey(!showDrugKey)}
          tabIndex={-1}
        >
          {showDrugKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <Button
        size="sm"
        disabled={isSavingDrugKey || !drugApiKey.trim()}
        onClick={handleSaveDrugApiKey}
      >
        {isSavingDrugKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      공공데이터포털(data.go.kr) → 마이페이지 → 활용신청 현황에서 인증키를 확인할 수 있습니다.
    </p>
  </CardContent>
</Card>
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/queries/settings.ts apps/web/src/components/ai-settings.tsx
git commit -m "feat(settings): add drug API service key management to settings page"
```

---

### Task 3: API Route 생성 — 식약처 API 프록시

**Files:**
- Create: `apps/web/src/app/api/drug-search/route.ts`

**Step 1: API route 구현**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DrugSearchResult } from "@/lib/types";

const BASE_URL = "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07";

async function getDrugApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  const val = data?.value;
  return typeof val === "string" && val.length > 0 ? val : null;
}

export async function GET(req: Request) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  const page = Number(searchParams.get("page") ?? "1");
  const size = Number(searchParams.get("size") ?? "10");

  if (!query) {
    return NextResponse.json({ error: "query parameter is required" }, { status: 400 });
  }

  const serviceKey = await getDrugApiKey();
  if (!serviceKey) {
    return NextResponse.json(
      { error: "의약품 API 키가 설정되지 않았습니다. 설정 페이지에서 공공데이터포털 인증키를 등록해주세요." },
      { status: 422 },
    );
  }

  try {
    const params = new URLSearchParams({
      serviceKey,
      pageNo: String(page),
      numOfRows: String(size),
      type: "json",
      item_name: query,
    });

    const apiUrl = `${BASE_URL}/getDrugPrdtPrmsnDtlInq06?${params.toString()}`;
    const res = await fetch(apiUrl, { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `식약처 API 오류 (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // 공공데이터 API response structure
    const body = data.body;
    if (!body) {
      return NextResponse.json({ items: [], totalCount: 0, pageNo: page, numOfRows: size });
    }

    const totalCount = body.totalCount ?? 0;
    const rawItems: unknown[] = body.items ?? [];

    const items: DrugSearchResult[] = rawItems.map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      return {
        item_seq: String(r.ITEM_SEQ ?? ""),
        item_name: String(r.ITEM_NAME ?? ""),
        entp_name: String(r.ENTP_NAME ?? ""),
        entp_no: String(r.ENTP_NO ?? ""),
        item_permit_date: String(r.ITEM_PERMIT_DATE ?? ""),
        edi_code: r.EDI_CODE ? String(r.EDI_CODE) : null,
        atc_code: r.ATC_CODE ? String(r.ATC_CODE) : null,
        main_item_ingr: r.MAIN_ITEM_INGR ? String(r.MAIN_ITEM_INGR) : null,
        bar_code: r.BAR_CODE ? String(r.BAR_CODE) : null,
        bizrno: r.BIZRNO ? String(r.BIZRNO) : null,
        rare_drug_yn: r.RARE_DRUG_YN ? String(r.RARE_DRUG_YN) : null,
      };
    });

    return NextResponse.json({ items, totalCount, pageNo: page, numOfRows: size });
  } catch (err) {
    return NextResponse.json(
      { error: `의약품 검색 실패: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
```

**주의:** 공공데이터포털 API 응답 구조는 `{ header: {...}, body: { items: [...], totalCount, ... } }` 형태. 필드명은 대문자(`ITEM_SEQ`, `ITEM_NAME` 등). 실제 응답 확인 후 매핑 조정 필요할 수 있음.

**Step 2: Commit**

```bash
git add apps/web/src/app/api/drug-search/route.ts
git commit -m "feat(api): add drug-search proxy route for MFDS drug product API"
```

---

### Task 4: DrugSearchDialog 공통 컴포넌트 생성

**Files:**
- Create: `apps/web/src/components/drug-search-dialog.tsx`

**Step 1: 컴포넌트 구현**

이 컴포넌트는 ProductFormDialog와 OrderTable 양쪽에서 사용됨.

- **mode="select"**: 검색 → 선택 → onSelect callback (DrugSearchResult 전달)
- debounce 300ms로 API 호출
- 결과 테이블: 품목명, 업체명, 보험코드, 주성분
- 페이지네이션 지원
- "이 의약품으로 품목 생성" 버튼으로 자동 product 생성 후 callback

```typescript
"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createProduct } from "@/lib/actions";
import type { DrugSearchResult, DrugSearchResponse } from "@/lib/types";

interface DrugSearchDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created product id and drug data when a drug is selected and product created */
  onProductCreated?: (productId: number, drug: DrugSearchResult) => void;
  /** Called with drug data only (no product creation) for form fill */
  onDrugSelect?: (drug: DrugSearchResult) => void;
  /** "create" = auto-create product on select, "fill" = just return drug data */
  mode?: "create" | "fill";
}

export function DrugSearchDialog({
  open,
  onClose,
  onProductCreated,
  onDrugSelect,
  mode = "fill",
}: DrugSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pageSize = 10;

  const search = useCallback(async (searchQuery: string, pageNo: number) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        page: String(pageNo),
        size: String(pageSize),
      });
      const res = await fetch(`/api/drug-search?${params}`);
      const data: DrugSearchResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as unknown as { error: string }).error || "검색 실패");
      }
      setResults(data.items);
      setTotalCount(data.totalCount);
      setPage(pageNo);
    } catch (err) {
      toast.error(`의약품 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(query, 1);
  }

  function handlePageChange(newPage: number) {
    search(query, newPage);
  }

  function handleSelect(drug: DrugSearchResult) {
    if (mode === "fill") {
      onDrugSelect?.(drug);
      onClose();
      return;
    }

    // mode === "create": auto-create product
    startTransition(async () => {
      try {
        const productData = {
          official_name: drug.item_name,
          category: "medication",
          manufacturer: drug.entp_name || undefined,
          ingredient: drug.main_item_ingr || undefined,
          standard_code: drug.edi_code || undefined,
        };

        // createProduct doesn't return the id, so we need a different approach
        // We'll create and then query for the newly created product
        await createProduct(productData);

        // For now, notify success and let parent handle refresh
        toast.success(`"${drug.item_name}" 품목이 생성되었습니다.`);
        onProductCreated?.(0, drug); // id=0 signals caller to refresh
        onClose();
      } catch (err) {
        toast.error(`품목 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>의약품 검색 (식약처 API)</DialogTitle>
        </DialogHeader>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="의약품명을 입력하세요 (예: 타이레놀, 아스피린)"
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={isSearching || !query.trim()}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Search className="h-4 w-4 mr-1" />검색</>
            )}
          </Button>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {results.length === 0 && !isSearching && (
            <p className="text-sm text-muted-foreground text-center py-8">
              검색어를 입력하고 검색 버튼을 클릭하세요.
            </p>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">검색 중...</span>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">
                  총 {totalCount.toLocaleString()}건 중 {results.length}건 표시
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">품목명</TableHead>
                      <TableHead className="text-xs w-[100px]">업체명</TableHead>
                      <TableHead className="text-xs w-[90px]">보험코드</TableHead>
                      <TableHead className="text-xs w-[140px]">주성분</TableHead>
                      <TableHead className="text-xs w-[60px]">선택</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((drug) => (
                      <TableRow key={drug.item_seq}>
                        <TableCell className="text-sm">
                          <div>
                            <p className="font-medium truncate max-w-[280px]">{drug.item_name}</p>
                            {drug.rare_drug_yn === "Y" && (
                              <Badge variant="outline" className="text-xs mt-0.5">희귀</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{drug.entp_name}</TableCell>
                        <TableCell className="text-xs font-mono">{drug.edi_code || "-"}</TableCell>
                        <TableCell className="text-xs truncate max-w-[140px]">
                          {drug.main_item_ingr || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={isPending}
                            onClick={() => handleSelect(drug)}
                          >
                            {mode === "create" ? (
                              <><Plus className="h-3.5 w-3.5 mr-0.5" />추가</>
                            ) : (
                              "선택"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isSearching}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isSearching}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/drug-search-dialog.tsx
git commit -m "feat(ui): add DrugSearchDialog component for MFDS drug product search"
```

---

### Task 5: createProduct가 생성된 product ID를 반환하도록 수정

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

**Step 1: createProduct 함수 수정**

현재 `createProduct`는 `{ success: true }`만 반환함. 생성된 product ID가 필요하므로 `.select().single()` 추가.

```typescript
// 기존:
export async function createProduct(data: { ... }) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ...data,
    name: data.official_name,
  });
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

// 변경:
export async function createProduct(data: {
  official_name: string;
  short_name?: string;
  category?: string;
  manufacturer?: string;
  ingredient?: string;
  efficacy?: string;
  standard_code?: string;
  unit?: string;
  unit_price?: number;
  auto_info?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("products").insert({
    ...data,
    name: data.official_name,
  }).select("id").single();
  if (error) throw error;
  revalidatePath("/products");
  return { success: true, id: row.id as number };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): return created product id from createProduct"
```

---

### Task 6: DrugSearchDialog의 create 모드에서 product ID 활용

**Files:**
- Modify: `apps/web/src/components/drug-search-dialog.tsx`

**Step 1: handleSelect에서 반환된 id 사용**

```typescript
// handleSelect 내 mode === "create" 부분 수정:
const result = await createProduct(productData);
toast.success(`"${drug.item_name}" 품목이 생성되었습니다.`);
onProductCreated?.(result.id, drug);
onClose();
```

**Step 2: auto_info에 API 데이터 저장**

productData에 auto_info 추가:

```typescript
const productData = {
  official_name: drug.item_name,
  category: "medication",
  manufacturer: drug.entp_name || undefined,
  ingredient: drug.main_item_ingr || undefined,
  standard_code: drug.edi_code || undefined,
  auto_info: {
    source: "mfds_api",
    item_seq: drug.item_seq,
    bar_code: drug.bar_code,
    atc_code: drug.atc_code,
    item_permit_date: drug.item_permit_date,
    entp_no: drug.entp_no,
    rare_drug_yn: drug.rare_drug_yn,
    bizrno: drug.bizrno,
  },
};
```

**Step 3: Commit**

```bash
git add apps/web/src/components/drug-search-dialog.tsx
git commit -m "feat(drug-search): use returned product id and save auto_info from API data"
```

---

### Task 7: ProductFormDialog에 의약품 검색 통합

**Files:**
- Modify: `apps/web/src/components/product-list.tsx`

**Step 1: import 추가**

```typescript
import { DrugSearchDialog } from "@/components/drug-search-dialog";
import type { DrugSearchResult } from "@/lib/types";
import { Pill } from "lucide-react"; // 또는 Search 아이콘 사용
```

**Step 2: ProductFormDialog에 state 추가**

`ProductFormDialog` 함수 내부:

```typescript
const [showDrugSearch, setShowDrugSearch] = useState(false);
```

**Step 3: 의약품 검색 버튼 추가**

기존 AI 검색 버튼 옆에 추가. 현재 품목명 + AI검색 버튼이 있는 `<div className="flex gap-2">` 안에:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => setShowDrugSearch(true)}
  className="shrink-0"
>
  <Pill className="h-4 w-4 mr-1" />의약품
</Button>
```

**Step 4: DrugSearchDialog 렌더링 추가**

form 닫는 태그 전에:

```tsx
<DrugSearchDialog
  open={showDrugSearch}
  onClose={() => setShowDrugSearch(false)}
  mode="fill"
  onDrugSelect={(drug: DrugSearchResult) => {
    setOfficialName(drug.item_name);
    if (drug.entp_name) setManufacturer(drug.entp_name);
    if (drug.main_item_ingr) setIngredient(drug.main_item_ingr);
    if (drug.edi_code) setStandardCode(drug.edi_code);
    setCategory("medication");
    toast.success("의약품 정보가 입력되었습니다.");
  }}
/>
```

**Step 5: Commit**

```bash
git add apps/web/src/components/product-list.tsx
git commit -m "feat(products): integrate drug search dialog into ProductFormDialog"
```

---

### Task 8: OrderTable에 의약품 검색 통합

**Files:**
- Modify: `apps/web/src/components/order-table.tsx`

**Step 1: import 추가**

```typescript
import { DrugSearchDialog } from "@/components/drug-search-dialog";
import type { DrugSearchResult } from "@/lib/types";
import { Pill } from "lucide-react";
```

**Step 2: OrderAccordionContent에 state 추가**

```typescript
const [drugSearchItemId, setDrugSearchItemId] = useState<number | null>(null);
```

**Step 3: 품목 편집 모드에서 의약품 검색 버튼 추가**

현재 편집 모드에서 품목 선택은 `Popover > Command` 콤보박스. 이 옆에 작은 의약품 검색 버튼 추가.

items sub-table의 품목 셀 (`isEditing` 분기) 내부, Popover 뒤에:

```tsx
{isEditing ? (
  <div className="flex items-center gap-1">
    <Popover ...>
      {/* 기존 품목 선택 Combobox */}
    </Popover>
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      title="의약품 API 검색"
      onClick={() => setDrugSearchItemId(item.id)}
    >
      <Pill className="h-3.5 w-3.5" />
    </Button>
  </div>
) : ( ... )}
```

**Step 4: DrugSearchDialog 렌더링 (OrderAccordionContent 내)**

컴포넌트 return JSX 마지막에:

```tsx
{drugSearchItemId !== null && (
  <DrugSearchDialog
    open={drugSearchItemId !== null}
    onClose={() => setDrugSearchItemId(null)}
    mode="create"
    onProductCreated={(productId: number, _drug: DrugSearchResult) => {
      if (drugSearchItemId) {
        updateItemField(drugSearchItemId, "product_id", productId);
      }
      setDrugSearchItemId(null);
      router.refresh();
    }}
  />
)}
```

**Step 5: Commit**

```bash
git add apps/web/src/components/order-table.tsx
git commit -m "feat(orders): integrate drug search dialog into order item editing"
```

---

### Task 9: API 응답 구조 검증 및 보정

**Files:**
- Modify: `apps/web/src/app/api/drug-search/route.ts`

**Step 1: 실제 API 호출 테스트**

브라우저에서 `/api/drug-search?query=타이레놀` 또는 curl 테스트:

```bash
curl "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?serviceKey=YOUR_KEY&type=json&numOfRows=3&item_name=타이레놀"
```

**Step 2: 응답 구조에 따라 매핑 보정**

공공데이터 API는 응답 구조가 다를 수 있음:
- `body.items`가 배열이 아니라 `body.items.item`일 수 있음
- 필드명이 `ITEM_SEQ` 대신 `item_seq` (소문자)일 수 있음
- 결과가 1건일 때 배열이 아닌 단일 객체일 수 있음

이에 대한 방어 코드:

```typescript
// rawItems 추출 보정
let rawItems: unknown[];
if (Array.isArray(body.items)) {
  rawItems = body.items;
} else if (body.items?.item) {
  rawItems = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
} else {
  rawItems = [];
}
```

필드명 대/소문자 모두 대응:

```typescript
function getField(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "") return String(r[k]);
  }
  return null;
}

// 사용:
item_seq: getField(r, "ITEM_SEQ", "item_seq") ?? "",
item_name: getField(r, "ITEM_NAME", "item_name") ?? "",
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/drug-search/route.ts
git commit -m "fix(drug-search): handle variable API response structures from MFDS API"
```

---

### Task 10: 통합 테스트 및 최종 확인

**Step 1: Settings 페이지에서 API 키 등록**

1. `/settings` 페이지 접속
2. "의약품 API 키" 카드에서 공공데이터포털 인증키 입력 → 저장
3. "등록됨" 뱃지 및 마스킹된 키 확인

**Step 2: 품목 관리 페이지 테스트**

1. `/products` 페이지 → "품목 추가" 클릭
2. "의약품" 버튼 클릭 → DrugSearchDialog 열림
3. "타이레놀" 검색 → 결과 확인
4. 결과에서 "선택" → 폼에 자동 입력 확인 (품목명, 제조사, 성분, 보험코드, 카테고리=약품)
5. 저장

**Step 3: 주문 테이블 테스트**

1. `/orders` 페이지 → 주문 열기 → "수정" 클릭
2. 품목 셀의 💊 버튼 클릭 → DrugSearchDialog 열림
3. 의약품 검색 → "추가" → 새 product 자동 생성, order_item에 연결
4. "저장" 확인

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete drug API integration for product management and order editing"
```

---

## 파일 변경 요약

| 파일 | 유형 | 설명 |
|---|---|---|
| `apps/web/src/lib/types.ts` | 수정 | DrugSearchResult, DrugSearchResponse 타입 추가 |
| `apps/web/src/lib/queries/settings.ts` | 수정 | drug_api_service_key 조회 추가 |
| `apps/web/src/components/ai-settings.tsx` | 수정 | 의약품 API 키 관리 카드 추가 |
| `apps/web/src/app/api/drug-search/route.ts` | 신규 | 식약처 API 프록시 라우트 |
| `apps/web/src/components/drug-search-dialog.tsx` | 신규 | 의약품 검색 공통 다이얼로그 |
| `apps/web/src/lib/actions.ts` | 수정 | createProduct가 id 반환 |
| `apps/web/src/components/product-list.tsx` | 수정 | ProductFormDialog에 의약품 검색 버튼 통합 |
| `apps/web/src/components/order-table.tsx` | 수정 | OrderAccordionContent에 의약품 검색 버튼 통합 |
