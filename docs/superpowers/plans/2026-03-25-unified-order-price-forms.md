# Unified Order Price Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the order item price columns, VAT calculation, terminology, and footer totals across order creation, order list accordion, and order detail page.

**Architecture:** Modify each of the 3 files independently (no shared component extraction). Apply identical column structure, VAT calculation formulas, and terminology. DB schema and server actions remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, shadcn/ui, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-25-unified-order-price-forms-design.md`

---

### Task 1: purchase-order-form.tsx — Terminology + Footer

The baseline form. Only terminology changes and footer additions needed.

**Files:**
- Modify: `apps/web/src/components/purchase-order-form.tsx`

- [ ] **Step 1: Change "매출단가" to "판매단가" in table header**

At line 780, change the header text:
```tsx
// Before (line 779-781):
<TableHead className="text-xs text-right relative" style={{ width: colWidths["selling_price"] ?? 80 }}>
  매출단가

// After:
<TableHead className="text-xs text-right relative" style={{ width: colWidths["selling_price"] ?? 80 }}>
  판매단가
```

- [ ] **Step 2: Change "매출(VAT)" to "판매(VAT)" in table header**

At line 784, change:
```tsx
// Before (line 783-784):
<TableHead className="text-xs text-right relative" style={{ width: colWidths["selling_vat"] ?? 90 }}>
  매출(VAT)

// After:
<TableHead className="text-xs text-right relative" style={{ width: colWidths["selling_vat"] ?? 90 }}>
  판매(VAT)
```

- [ ] **Step 3: Add 공급가액/세액/합계 to footer**

At line 1051 (after the 이익률 row, before the closing `</div>`), add:

```tsx
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">공급가액</span>
                    <span className="tabular-nums">₩{totalSupply.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">세액</span>
                    <span className="tabular-nums">₩{totalTax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">합계</span>
                    <span className="tabular-nums font-semibold">₩{(totalSupply + totalTax).toLocaleString()}</span>
                  </div>
```

- [ ] **Step 4: Add totalSupply and totalTax calculations**

Near line 350 (after `totalSelling` and before `totalMargin`), add:

```tsx
  const totalSupply = items.reduce((s, i) => s + (i.selling_price ?? 0) * i.quantity, 0);
  const totalTax = items.reduce((s, i) => s + Math.round((i.selling_price ?? 0) * 0.1) * i.quantity, 0);
```

- [ ] **Step 5: Verify the form renders correctly**

Run: `npm run dev:web`
Open: `http://localhost:3000/orders/new`
Expected: Headers say "판매단가" and "판매(VAT)". Footer shows 공급가액/세액/합계 below 이익률.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/purchase-order-form.tsx
git commit -m "refactor: 주문생성 폼 — 판매단가 용어 통일 + 공급가액/세액 합계 추가"
```

---

### Task 2: order-table.tsx — Accordion Column Unification + Price Editing

The most significant changes: add VAT columns, enable price editing, fix VAT calculations, add footer.

**Files:**
- Modify: `apps/web/src/components/order-table.tsx`

- [ ] **Step 1: Expand ItemEdits interface to include price fields**

At line 371-375, change:
```tsx
// Before:
interface ItemEdits {
  quantity: number;
  product_id: number | null;
  supplier_id: number | null;
}

// After:
interface ItemEdits {
  quantity: number;
  purchase_price: number;
  unit_price: number;
  product_id: number | null;
  supplier_id: number | null;
}
```

- [ ] **Step 2: Update handleStartEdit to initialize price fields**

At line 411-421, change:
```tsx
  function handleStartEdit() {
    const initial: Record<number, ItemEdits> = {};
    for (const item of group.items) {
      initial[item.id] = {
        quantity: item.quantity,
        purchase_price: item.purchase_price ?? 0,
        unit_price: item.unit_price ?? 0,
        product_id: item.product_id,
        supplier_id: item.supplier_id ?? null,
      };
    }
    setEditItems(initial);
    setIsEditing(true);
  }
```

- [ ] **Step 3: Update handleSaveItems to save price fields**

At line 429-461, update the changes object construction:
```tsx
  function handleSaveItems() {
    startTransition(async () => {
      try {
        const updates: Promise<unknown>[] = [];
        for (const item of group.items) {
          const edits = editItems[item.id];
          if (!edits) continue;
          const changes: { quantity?: number; purchase_price?: number; unit_price?: number; product_id?: number; supplier_id?: number | null } = {};
          if (edits.quantity !== item.quantity) changes.quantity = edits.quantity;
          if (edits.purchase_price !== (item.purchase_price ?? 0)) changes.purchase_price = edits.purchase_price;
          if (edits.unit_price !== (item.unit_price ?? 0)) changes.unit_price = edits.unit_price;
          if (edits.product_id !== item.product_id && edits.product_id != null) {
            changes.product_id = edits.product_id;
          }
          if (edits.supplier_id !== (item.supplier_id ?? null)) {
            changes.supplier_id = edits.supplier_id;
          }
          if (Object.keys(changes).length > 0) {
            updates.push(updateOrderItemAction(item.id, changes));
          }
        }
        if (updates.length === 0) {
          setIsEditing(false);
          return;
        }
        await Promise.all(updates);
        toast.success(`${updates.length}개 품목이 수정되었습니다.`);
        setIsEditing(false);
        setEditItems({});
        router.refresh();
      } catch {
        toast.error("품목 수정에 실패했습니다.");
      }
    });
  }
```

- [ ] **Step 4: Update accordion table headers**

Replace the table header block (lines 589-603) with:
```tsx
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">품목</TableHead>
                <TableHead className="text-xs text-right w-[60px]">수량</TableHead>
                <TableHead className="text-xs text-right w-[60px]">박스</TableHead>
                <TableHead className="text-xs w-[50px]">단위</TableHead>
                <TableHead className="text-xs w-[80px]">매입처</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매입단가</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매입(VAT)</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매입총액</TableHead>
                <TableHead className="text-xs text-right w-[80px]">판매단가</TableHead>
                <TableHead className="text-xs text-right w-[80px]">판매(VAT)</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매출총액</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매출이익</TableHead>
                <TableHead className="text-xs text-right w-[60px]">이익률</TableHead>
                <TableHead className="text-xs w-[70px]">담당자</TableHead>
                <TableHead className="text-xs w-[80px]">KPIS</TableHead>
              </TableRow>
            </TableHeader>
```

- [ ] **Step 5: Add overflow-x-auto to accordion table wrapper**

At line 587, change:
```tsx
// Before:
<div className="rounded-md border bg-background">

// After:
<div className="rounded-md border bg-background overflow-x-auto">
```

- [ ] **Step 6: Replace accordion table body item rows**

Replace the entire item row rendering (lines 606-806) with unified columns. Each row now includes editable price inputs and VAT calculations:

```tsx
              {group.items.map((item) => {
                const edit = editItems[item.id];
                const qty = isEditing ? (edit?.quantity ?? item.quantity) : item.quantity;
                const pp = isEditing ? (edit?.purchase_price ?? (item.purchase_price ?? 0)) : (item.purchase_price ?? 0);
                const sp = isEditing ? (edit?.unit_price ?? (item.unit_price ?? 0)) : (item.unit_price ?? 0);
                const ppVat = Math.round(pp * 1.1);
                const spVat = Math.round(sp * 1.1);
                const purchaseTotal = ppVat * qty;
                const salesTotal = spVat * qty;
                const profit = salesTotal - purchaseTotal;
                const margin = salesTotal > 0 ? (profit / salesTotal) * 100 : 0;

                return (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Popover
                          open={productOpenId === item.id}
                          onOpenChange={(open: boolean) => setProductOpenId(open ? item.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="h-7 w-full max-w-[220px] justify-between font-normal text-sm px-2"
                            >
                              <span className="truncate">
                                {editItems[item.id]?.product_id
                                  ? products.find((p) => p.id === editItems[item.id]?.product_id)?.name ?? "미매칭"
                                  : "품목 검색..."}
                              </span>
                              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="품목명 검색..." />
                              <CommandList>
                                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        updateItemField(item.id, "product_id", p.id);
                                        setProductOpenId(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          editItems[item.id]?.product_id === p.id ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <span className="truncate">{p.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : (
                      <>{item.product_name}</>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={edit?.quantity ?? item.quantity}
                        onChange={(e) => updateItemField(item.id, "quantity", Number(e.target.value))}
                        className="h-7 w-[70px] text-right text-sm ml-auto"
                      />
                    ) : (
                      item.quantity.toLocaleString()
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.box_quantity != null ? item.box_quantity.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.unit_type ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {isEditing ? (
                      <SearchableCombobox
                        value={editItems[item.id]?.supplier_id ?? item.supplier_id}
                        displayName={item.supplier_name ?? undefined}
                        placeholder="공급처"
                        searchPlaceholder="공급처 검색..."
                        onSelect={(id) => updateItemField(item.id, "supplier_id", id)}
                        searchAction={searchSuppliersAction}
                        className="w-[160px]"
                      />
                    ) : (
                      item.supplier_name ?? "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={pp}
                        onChange={(e) => updateItemField(item.id, "purchase_price", Number(e.target.value))}
                        className="h-7 w-[70px] text-right text-xs ml-auto"
                        placeholder="단가"
                      />
                    ) : (
                      pp > 0 ? pp.toLocaleString() : "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={ppVat}
                        onChange={(e) => {
                          const vatIncl = e.target.value ? parseFloat(e.target.value) : 0;
                          updateItemField(item.id, "purchase_price", Math.round(vatIncl / 1.1));
                        }}
                        className="h-7 w-[70px] text-right text-xs ml-auto"
                        placeholder="VAT포함"
                      />
                    ) : (
                      pp > 0 ? ppVat.toLocaleString() : "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {pp > 0 ? purchaseTotal.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={sp}
                        onChange={(e) => updateItemField(item.id, "unit_price", Number(e.target.value))}
                        className="h-7 w-[70px] text-right text-xs ml-auto"
                        placeholder="단가"
                      />
                    ) : (
                      sp > 0 ? sp.toLocaleString() : "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={spVat}
                        onChange={(e) => {
                          const vatIncl = e.target.value ? parseFloat(e.target.value) : 0;
                          updateItemField(item.id, "unit_price", Math.round(vatIncl / 1.1));
                        }}
                        className="h-7 w-[70px] text-right text-xs ml-auto"
                        placeholder="VAT포함"
                      />
                    ) : (
                      sp > 0 ? spVat.toLocaleString() : "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-medium">
                    {sp > 0 ? salesTotal.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {sp > 0 && pp > 0 ? (
                      <span className={profit < 0 ? "text-red-500" : "text-green-600"}>{profit.toLocaleString()}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {salesTotal > 0 ? (
                      <span className={margin < 0 ? "text-red-500" : ""}>{margin.toFixed(1)}%</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.sales_rep ?? "-"}
                  </TableCell>
                  <TableCell>
                    {/* KPIS cell — keep existing KPIS editing logic unchanged */}
                    {kpisEditId === item.id ? (
                      /* ... existing KPIS edit UI ... */
                    ) : (
                      /* ... existing KPIS display UI ... */
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
```

**Note:** The KPIS cell content (lines 728-805) should be preserved exactly as-is within the last `<TableCell>`. The comment above is a placeholder — copy the existing KPIS JSX from the current code.

- [ ] **Step 7: Add footer totals section after the items table**

After the closing `</div>` of the table wrapper (after line 810), before `<Separator />` (line 813), add:

```tsx
        {/* Footer totals */}
        <div className="flex justify-end mt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground text-right">매입합계</span>
            <span className="text-right tabular-nums">
              {group.items.reduce((s, i) => s + Math.round((i.purchase_price ?? 0) * 1.1) * i.quantity, 0).toLocaleString()}원
            </span>
            <span className="text-muted-foreground text-right">매출합계</span>
            <span className="text-right tabular-nums font-medium">
              {group.items.reduce((s, i) => s + Math.round((i.unit_price ?? 0) * 1.1) * i.quantity, 0).toLocaleString()}원
            </span>
            {(() => {
              const pt = group.items.reduce((s, i) => s + Math.round((i.purchase_price ?? 0) * 1.1) * i.quantity, 0);
              const st = group.items.reduce((s, i) => s + Math.round((i.unit_price ?? 0) * 1.1) * i.quantity, 0);
              const mg = st - pt;
              const mr = st > 0 ? (mg / st) * 100 : 0;
              return (
                <>
                  <span className="text-muted-foreground text-right">마진</span>
                  <span className={cn("text-right tabular-nums", mg >= 0 ? "text-green-600" : "text-red-500")}>
                    {mg.toLocaleString()}원 ({st > 0 ? mr.toFixed(1) : "-"}%)
                  </span>
                </>
              );
            })()}
            <Separator className="col-span-2 my-1" />
            <span className="text-muted-foreground text-right">공급가액</span>
            <span className="text-right tabular-nums">
              {group.items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0).toLocaleString()}원
            </span>
            <span className="text-muted-foreground text-right">세액</span>
            <span className="text-right tabular-nums">
              {group.items.reduce((s, i) => s + Math.round((i.unit_price ?? 0) * 0.1) * i.quantity, 0).toLocaleString()}원
            </span>
            <span className="font-medium text-right">합계</span>
            <span className="font-medium text-right tabular-nums">
              {(() => {
                const supply = group.items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0);
                const tax = group.items.reduce((s, i) => s + Math.round((i.unit_price ?? 0) * 0.1) * i.quantity, 0);
                return (supply + tax).toLocaleString();
              })()}원
            </span>
          </div>
        </div>
```

- [ ] **Step 8: Fix summary row VAT calculation (per-item rounding)**

At lines 290-295, change the summary row calculation:
```tsx
// Before:
const purchaseTotal = Math.round(group.items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0) * v);
const salesTotal = Math.round(group.items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0) * v);

// After:
const purchaseTotal = group.items.reduce((s, i) => s + Math.round((i.purchase_price ?? 0) * v) * i.quantity, 0);
const salesTotal = group.items.reduce((s, i) => s + Math.round((i.unit_price ?? 0) * v) * i.quantity, 0);
```

- [ ] **Step 9: Update "매출총액" header label in the main table**

At line 181, change:
```tsx
// Before:
<ResizableTh width={widths.sales_total} colKey="sales_total" onResizeStart={onMouseDown} className="text-right">매출총액</ResizableTh>

// This stays "매출총액" (not "판매총액") — this is the summary column, spec uses "매출총액"
```

No change needed for the summary row headers — they already use "매출총액", "매출이익" which matches the spec.

- [ ] **Step 10: Verify accordion rendering**

Run: `npm run dev:web`
Open: `http://localhost:3000/orders`
Click expand on any order row.
Expected: New column headers (판매단가, 판매(VAT), 매입(VAT), etc.), editable prices in edit mode, footer totals visible.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/order-table.tsx
git commit -m "refactor: 주문목록 확장행 — 통일 컬럼 + 가격편집 + VAT계산 + 합계영역"
```

---

### Task 3: order-detail-client.tsx — Column Expansion + VAT Toggle Removal

Add missing columns, remove VAT toggle, update footer.

**Files:**
- Modify: `apps/web/src/components/order-detail-client.tsx`

- [ ] **Step 1: Update DETAIL_COL_DEFAULTS to include new columns**

At line 98-100, change:
```tsx
const DETAIL_COL_DEFAULTS: Record<string, number> = {
  idx: 40, product: 180, supplier: 100, quantity: 60, unit_type: 50,
  purchase_price: 80, purchase_vat: 80, purchase_total: 90,
  unit_price: 80, selling_vat: 80, sales_total: 90,
  profit: 90, profit_rate: 60, sales_rep: 80,
};
```

- [ ] **Step 2: Remove vatInclusive state**

Find and remove the `vatInclusive` state declaration (around line 175):
```tsx
// Remove this line:
const [vatInclusive, setVatInclusive] = useState(false);
```

Also remove the `setVatInclusive(false)` call in `handleCancelEdit` (line 206).

- [ ] **Step 3: Remove VAT toggle checkbox UI**

Remove the entire VAT toggle block (lines 481-523) — the `{isEditing && (` block containing the checkbox labeled "VAT 포함".

- [ ] **Step 4: Simplify handleSaveItems — remove VAT toggle conversion**

At lines 254-257, simplify:
```tsx
// Before:
const edit = vatInclusive
  ? { ...rawEdit, unit_price: Math.round(rawEdit.unit_price / 1.1), purchase_price: Math.round(rawEdit.purchase_price / 1.1) }
  : rawEdit;

// After:
const edit = rawEdit;
```

- [ ] **Step 5: Update computed totals to use per-item VAT rounding**

Replace lines 339-356:
```tsx
  // --- Computed totals ---
  const visibleItems = order.items.filter((item) => !deletedIds.has(item.id));

  const purchaseTotal = visibleItems.reduce((sum, item) => {
    const edit = editItems[item.id];
    const qty = edit?.quantity ?? item.quantity;
    const pp = edit?.purchase_price ?? (item.purchase_price ?? 0);
    return sum + Math.round(pp * 1.1) * qty;
  }, 0);

  const salesTotal = visibleItems.reduce((sum, item) => {
    const edit = editItems[item.id];
    const qty = edit ? edit.quantity : item.quantity;
    const sp = edit ? edit.unit_price : (item.unit_price ?? 0);
    return sum + Math.round(sp * 1.1) * qty;
  }, 0);

  const supplyTotal = visibleItems.reduce((sum, item) => {
    const edit = editItems[item.id];
    const qty = edit ? edit.quantity : item.quantity;
    const sp = edit ? edit.unit_price : (item.unit_price ?? 0);
    return sum + sp * qty;
  }, 0);

  const taxTotal = visibleItems.reduce((sum, item) => {
    const edit = editItems[item.id];
    const qty = edit ? edit.quantity : item.quantity;
    const sp = edit ? edit.unit_price : (item.unit_price ?? 0);
    return sum + Math.round(sp * 0.1) * qty;
  }, 0);

  const totalMargin = salesTotal - purchaseTotal;
  const marginRate = salesTotal > 0 ? (totalMargin / salesTotal) * 100 : 0;
```

- [ ] **Step 6: Update table headers**

Replace lines 591-602:
```tsx
            <TableHeader>
              <TableRow>
                <ResizableTh width={widths.idx} colKey="idx" onResizeStart={onMouseDown} className="pl-6">#</ResizableTh>
                <ResizableTh width={widths.product} colKey="product" onResizeStart={onMouseDown}>품목</ResizableTh>
                <ResizableTh width={widths.supplier} colKey="supplier" onResizeStart={onMouseDown}>매입처</ResizableTh>
                <ResizableTh width={widths.quantity} colKey="quantity" onResizeStart={onMouseDown} className="text-right">수량</ResizableTh>
                <ResizableTh width={widths.unit_type} colKey="unit_type" onResizeStart={onMouseDown}>단위</ResizableTh>
                <ResizableTh width={widths.purchase_price} colKey="purchase_price" onResizeStart={onMouseDown} className="text-right">매입단가</ResizableTh>
                <ResizableTh width={widths.purchase_vat} colKey="purchase_vat" onResizeStart={onMouseDown} className="text-right">매입(VAT)</ResizableTh>
                <ResizableTh width={widths.purchase_total} colKey="purchase_total" onResizeStart={onMouseDown} className="text-right">매입총액</ResizableTh>
                <ResizableTh width={widths.unit_price} colKey="unit_price" onResizeStart={onMouseDown} className="text-right">판매단가</ResizableTh>
                <ResizableTh width={widths.selling_vat} colKey="selling_vat" onResizeStart={onMouseDown} className="text-right">판매(VAT)</ResizableTh>
                <ResizableTh width={widths.sales_total} colKey="sales_total" onResizeStart={onMouseDown} className="text-right">매출총액</ResizableTh>
                <ResizableTh width={widths.profit} colKey="profit" onResizeStart={onMouseDown} className="text-right">매출이익</ResizableTh>
                <ResizableTh width={widths.profit_rate} colKey="profit_rate" onResizeStart={onMouseDown} className="text-right">이익률</ResizableTh>
                <ResizableTh width={widths.sales_rep} colKey="sales_rep" onResizeStart={onMouseDown} className="pr-6">담당자</ResizableTh>
                {isEditing && <th className="w-[40px] print:hidden" />}
              </TableRow>
            </TableHeader>
```

- [ ] **Step 7: Update table body row cells**

Replace the row rendering (lines 606-822). The row variable setup and new cells:

```tsx
              {order.items.map((item, idx) => {
                const isDeleted = deletedIds.has(item.id);
                const productName = item.products?.official_name || item.products?.name
                  || item.product_name
                  || `제품 #${item.product_id ?? "미매칭"}`;

                const edit = editItems[item.id];
                const qty = edit ? edit.quantity : item.quantity;
                const pp = edit ? edit.purchase_price : (item.purchase_price ?? 0);
                const sp = edit ? edit.unit_price : (item.unit_price ?? 0);
                const ppVat = Math.round(pp * 1.1);
                const spVat = Math.round(sp * 1.1);
                const linePurchaseTotal = ppVat * qty;
                const lineSalesTotal = spVat * qty;
                const lineProfit = lineSalesTotal - linePurchaseTotal;
                const lineMargin = lineSalesTotal > 0 ? (lineProfit / lineSalesTotal) * 100 : 0;

                return (
                  <TableRow
                    key={item.id}
                    className={isDeleted ? "opacity-30 line-through" : undefined}
                  >
                    <TableCell className="pl-6 text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      {/* Keep existing product cell with Popover/Command — unchanged */}
                      {isEditing && !isDeleted ? (
                        /* ... existing product Popover ... */
                      ) : (
                        productName
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Keep existing supplier cell — unchanged */}
                      {isEditing && !isDeleted ? (
                        /* ... existing supplier Popover ... */
                      ) : (
                        item.supplier_name ?? "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0}
                          value={qty}
                          onChange={(e) => updateEditItem(item.id, "quantity", Number(e.target.value))}
                          className="h-7 w-[70px] text-right text-sm ml-auto"
                        />
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.unit_type ?? "piece"}
                    </TableCell>
                    {/* 매입단가 */}
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0}
                          value={pp}
                          onChange={(e) => updateEditItem(item.id, "purchase_price", Number(e.target.value))}
                          className="h-7 w-[80px] text-right text-sm ml-auto"
                        />
                      ) : (
                        pp > 0 ? pp.toLocaleString("ko-KR") : "-"
                      )}
                    </TableCell>
                    {/* 매입(VAT) */}
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0}
                          value={ppVat}
                          onChange={(e) => {
                            const v = e.target.value ? parseFloat(e.target.value) : 0;
                            updateEditItem(item.id, "purchase_price", Math.round(v / 1.1));
                          }}
                          className="h-7 w-[80px] text-right text-sm ml-auto"
                        />
                      ) : (
                        pp > 0 ? ppVat.toLocaleString("ko-KR") : "-"
                      )}
                    </TableCell>
                    {/* 매입총액 */}
                    <TableCell className="text-right tabular-nums">
                      {pp > 0 ? linePurchaseTotal.toLocaleString("ko-KR") : "-"}
                    </TableCell>
                    {/* 판매단가 */}
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0}
                          value={sp}
                          onChange={(e) => updateEditItem(item.id, "unit_price", Number(e.target.value))}
                          className="h-7 w-[80px] text-right text-sm ml-auto"
                        />
                      ) : (
                        sp > 0 ? sp.toLocaleString("ko-KR") : "-"
                      )}
                    </TableCell>
                    {/* 판매(VAT) */}
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0}
                          value={spVat}
                          onChange={(e) => {
                            const v = e.target.value ? parseFloat(e.target.value) : 0;
                            updateEditItem(item.id, "unit_price", Math.round(v / 1.1));
                          }}
                          className="h-7 w-[80px] text-right text-sm ml-auto"
                        />
                      ) : (
                        sp > 0 ? spVat.toLocaleString("ko-KR") : "-"
                      )}
                    </TableCell>
                    {/* 매출총액 */}
                    <TableCell className="text-right tabular-nums font-medium">
                      {sp > 0 ? lineSalesTotal.toLocaleString("ko-KR") : "-"}
                    </TableCell>
                    {/* 매출이익 */}
                    <TableCell className="text-right tabular-nums">
                      {sp > 0 && pp > 0 ? (
                        <span className={lineProfit < 0 ? "text-red-500" : "text-green-600"}>
                          {lineProfit.toLocaleString("ko-KR")}
                        </span>
                      ) : "-"}
                    </TableCell>
                    {/* 이익률 */}
                    <TableCell className="text-right tabular-nums">
                      {lineSalesTotal > 0 ? (
                        <span className={lineMargin < 0 ? "text-red-500" : ""}>
                          {lineMargin.toFixed(1)}%
                        </span>
                      ) : "-"}
                    </TableCell>
                    {/* 담당자 */}
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {item.sales_rep ?? "-"}
                    </TableCell>
                    {/* Delete button */}
                    {isEditing && (
                      <TableCell className="px-1 print:hidden">
                        {isDeleted ? (
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => unmarkItemDeleted(item.id)} title="삭제 취소">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => markItemDeleted(item.id)} title="품목 삭제">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
```

**Note:** The product Popover and supplier Popover cells should be preserved exactly from the existing code (lines 625-726). The comment placeholders above mark where to keep them.

- [ ] **Step 8: Update footer totals**

Replace lines 828-863:
```tsx
      {/* Totals */}
      {salesTotal > 0 && (
        <>
          <Separator />
          <div className="flex justify-end">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground text-right">매입합계</span>
              <span className="text-right tabular-nums">
                {purchaseTotal.toLocaleString("ko-KR")}원
              </span>
              <span className="text-muted-foreground text-right">매출합계</span>
              <span className="text-right tabular-nums font-medium">
                {salesTotal.toLocaleString("ko-KR")}원
              </span>
              <span className="text-muted-foreground text-right">마진</span>
              <span className={cn("text-right tabular-nums", totalMargin >= 0 ? "text-green-600" : "text-red-500")}>
                {totalMargin.toLocaleString("ko-KR")}원 ({salesTotal > 0 ? marginRate.toFixed(1) : "-"}%)
              </span>
              <Separator className="col-span-2 my-1" />
              <span className="text-muted-foreground text-right">공급가액</span>
              <span className="text-right tabular-nums">
                {supplyTotal.toLocaleString("ko-KR")}원
              </span>
              <span className="text-muted-foreground text-right">세액</span>
              <span className="text-right tabular-nums">
                {taxTotal.toLocaleString("ko-KR")}원
              </span>
              <span className="font-semibold text-right">합계</span>
              <span className="font-semibold text-right tabular-nums">
                {(supplyTotal + taxTotal).toLocaleString("ko-KR")}원
              </span>
            </div>
          </div>
        </>
      )}
```

- [ ] **Step 9: Verify the detail page renders correctly**

Run: `npm run dev:web`
Open: `http://localhost:3000/orders/<any-order-id>`
Expected:
- No VAT toggle checkbox
- Full column set: 매입단가, 매입(VAT), 매입총액, 판매단가, 판매(VAT), 매출총액, 매출이익, 이익률
- Footer shows 매입합계, 매출합계, 마진, 공급가액, 세액, 합계
- Edit mode: all price fields editable with VAT reverse-input working

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/order-detail-client.tsx
git commit -m "refactor: 주문상세 — 통일 컬럼 + VAT토글 제거 + 합계 통일"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Run lint**

```bash
npm run lint:web
```

Fix any lint errors.

- [ ] **Step 2: Run build**

```bash
npm run build:web
```

Fix any type errors.

- [ ] **Step 3: Cross-page verification**

Compare all 3 pages side-by-side:
1. `/orders/new` — 주문생성
2. `/orders` (expand any row) — 주문목록 확장행
3. `/orders/<id>` — 주문상세

Verify:
- Column order matches across all 3
- "판매단가" / "판매(VAT)" terminology everywhere (not "매출단가")
- VAT calculations use per-item rounding
- Footer shows: 매입합계, 매출합계, 마진, 공급가액, 세액, 합계
- Edit mode works correctly in all 3 locations

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: 주문 양식 통일 — lint/type 수정"
```
