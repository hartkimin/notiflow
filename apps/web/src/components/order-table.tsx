"use client";

import { memo, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  confirmOrderAction,
  deleteOrdersAction,
  searchHospitalsAction,
  searchSuppliersAction,
  updateDeliveryDateAction,
  updateOrderHospitalAction,
  updateOrderItemAction,
  updateOrderStatusAction,
  upsertKpisReportAction,
} from "@/app/(dashboard)/orders/actions";
import { SearchableCombobox } from "@/components/searchable-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import { toast } from "sonner";
import type { OrderItemFlat } from "@/lib/types";
import { ORDER_STATUS_LABELS as STATUS_LABEL, ORDER_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/order-status";

export interface ProductOption {
  id: number;
  name: string;
}

const ORDER_COL_DEFAULTS: Record<string, number> = {
  checkbox: 32, expand: 24, order_number: 110, order_date: 65, delivery_date: 65,
  hospital: 100, item_count: 45, purchase_total: 80, sales_total: 80, profit: 70, margin: 50, sales_rep: 60, status: 100, copy: 32, actions: 32,
};

const KPIS_LABEL: Record<string, string> = {
  pending: "미신고",
  reported: "신고완료",
  confirmed: "확인됨",
};

const KPIS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  reported: "default",
  confirmed: "outline",
};

interface OrderGroup {
  order_id: number;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  hospital_id: number | null;
  hospital_name: string;
  status: string;
  items: OrderItemFlat[];
}

function formatMMDD(dateStr: string | null): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}

export function OrderTable({
  items,
  products = [],
}: {
  items: OrderItemFlat[];
  products?: ProductOption[];
}) {
  const vatMultiplier = 1.1;
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const map = new Map<number, OrderGroup>();
    for (const item of items) {
      let group = map.get(item.order_id);
      if (!group) {
        group = {
          order_id: item.order_id,
          order_number: item.order_number,
          order_date: item.order_date,
          delivery_date: item.delivery_date,
          hospital_id: item.hospital_id,
          hospital_name: item.hospital_name,
          status: item.status,
          items: [],
        };
        map.set(item.order_id, group);
      }
      group.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  const { widths, onMouseDown } = useResizableColumns("orders", ORDER_COL_DEFAULTS);
  const allIds = useMemo(() => groups.map((g) => g.order_id), [groups]);
  const rowSelection = useRowSelection(allIds);

  function toggleExpand(orderId: number) {
    setExpandedId((prev) => (prev === orderId ? null : orderId));
  }

  const colCount = 15;

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table style={{ tableLayout: "fixed" }}>
          <TableHeader>
            <TableRow>
              <ResizableTh width={widths.checkbox} colKey="checkbox" onResizeStart={onMouseDown} className="px-2">
                <Checkbox
                  checked={rowSelection.allSelected ? true : rowSelection.someSelected ? "indeterminate" : false}
                  onCheckedChange={() => rowSelection.toggleAll()}
                  aria-label="모두 선택"
                />
              </ResizableTh>
              <ResizableTh width={widths.expand} colKey="expand" onResizeStart={onMouseDown} />
              <ResizableTh width={widths.order_number} colKey="order_number" onResizeStart={onMouseDown}>주문번호</ResizableTh>
              <ResizableTh width={widths.order_date} colKey="order_date" onResizeStart={onMouseDown}>발주일</ResizableTh>
              <ResizableTh width={widths.delivery_date} colKey="delivery_date" onResizeStart={onMouseDown}>배송일</ResizableTh>
              <ResizableTh width={widths.hospital} colKey="hospital" onResizeStart={onMouseDown}>거래처</ResizableTh>
              <ResizableTh width={widths.item_count} colKey="item_count" onResizeStart={onMouseDown} className="text-right">품목수</ResizableTh>
              <ResizableTh width={widths.purchase_total} colKey="purchase_total" onResizeStart={onMouseDown} className="text-right">매입총액</ResizableTh>
              <ResizableTh width={widths.sales_total} colKey="sales_total" onResizeStart={onMouseDown} className="text-right">매출총액</ResizableTh>
              <ResizableTh width={widths.profit} colKey="profit" onResizeStart={onMouseDown} className="text-right">매출이익</ResizableTh>
              <ResizableTh width={widths.margin} colKey="margin" onResizeStart={onMouseDown} className="text-right">이익률</ResizableTh>
              <ResizableTh width={widths.sales_rep} colKey="sales_rep" onResizeStart={onMouseDown}>담당자</ResizableTh>
              <ResizableTh width={widths.status} colKey="status" onResizeStart={onMouseDown}>상태</ResizableTh>
              <ResizableTh width={widths.copy} colKey="copy" onResizeStart={onMouseDown} />
              <ResizableTh width={widths.actions} colKey="actions" onResizeStart={onMouseDown} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  주문이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => {
                const isExpanded = expandedId === group.order_id;
                return (
                  <OrderGroupRow
                    key={group.order_id}
                    group={group}
                    products={products}
                    isExpanded={isExpanded}
                    isSelected={rowSelection.selected.has(group.order_id)}
                    onToggle={() => toggleExpand(group.order_id)}
                    onToggleSelect={() => rowSelection.toggle(group.order_id)}
                    colCount={colCount}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BulkActionBar
        count={rowSelection.count}
        onClear={rowSelection.clear}
        onDelete={() => deleteOrdersAction(Array.from(rowSelection.selected))}
        label="주문"
      />
    </>
  );
}

const OrderGroupRow = memo(function OrderGroupRow({
  group,
  products,
  isExpanded,
  isSelected,
  onToggle,
  onToggleSelect,
  colCount,
}: {
  group: OrderGroup;
  products: ProductOption[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onToggleSelect: () => void;
  colCount: number;
}) {
  const vatMultiplier = 1.1;
  return (
    <>
      {/* Summary row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        data-state={isExpanded ? "selected" : isSelected ? "selected" : undefined}
        onClick={onToggle}
      >
        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`주문 ${group.order_number} 선택`}
          />
        </TableCell>
        <TableCell className="px-2">
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </TableCell>
        <TableCell className="text-sm font-medium tabular-nums">
          {group.order_number}
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          {formatMMDD(group.order_date)}
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          {formatMMDD(group.delivery_date)}
        </TableCell>
        <TableCell className="text-sm">
          {group.hospital_name}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {group.items.length}
        </TableCell>
        {(() => {
          const v = vatMultiplier;
          const purchaseTotal = Math.round(group.items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0) * v);
          const salesTotal = Math.round(group.items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0) * v);
          const profit = salesTotal - purchaseTotal;
          const margin = salesTotal > 0 ? (profit / salesTotal) * 100 : 0;
          const reps = [...new Set(group.items.map((i) => i.sales_rep).filter(Boolean))];
          return (
            <>
              <TableCell className="text-right text-sm tabular-nums">
                {purchaseTotal > 0 ? purchaseTotal.toLocaleString() : "-"}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {salesTotal > 0 ? salesTotal.toLocaleString() : "-"}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {purchaseTotal > 0 || salesTotal > 0 ? (
                  <span className={profit < 0 ? "text-red-500" : "text-green-600"}>{profit.toLocaleString()}</span>
                ) : "-"}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {purchaseTotal > 0 || salesTotal > 0 ? (
                  <span className={margin < 0 ? "text-red-500" : ""}>{margin.toFixed(1)}%</span>
                ) : "-"}
              </TableCell>
              <TableCell className="text-sm truncate" title={reps.join(", ")}>
                {reps.length > 0 ? reps.join(", ") : "-"}
              </TableCell>
            </>
          );
        })()}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <button
            className="relative flex h-6 w-[100px] rounded-full border text-[10px] font-medium overflow-hidden cursor-pointer transition-colors"
            onClick={async () => {
              const next = group.status === "delivered" ? "confirmed" : "delivered";
              try {
                await updateOrderStatusAction(group.order_id, next);
                toast.success(next === "delivered" ? "완료 처리됨" : "미완료로 변경됨");
              } catch { toast.error("상태 변경 실패"); }
            }}
          >
            <span className={`flex-1 flex items-center justify-center transition-all ${group.status === "confirmed" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>미완료</span>
            <span className={`flex-1 flex items-center justify-center transition-all ${group.status === "delivered" ? "bg-green-600 text-white" : "text-muted-foreground"}`}>완료</span>
          </button>
        </TableCell>
        <TableCell className="px-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6" asChild title="주문 복사">
            <Link href={`/orders/new?copy_from=${group.order_id}`}>
              <Copy className="h-3 w-3" />
            </Link>
          </Button>
        </TableCell>
        <TableCell className="px-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
            <Link href={`/orders/${group.order_id}`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </TableCell>
      </TableRow>

      {/* Accordion detail */}
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={colCount} className="p-0">
            <OrderAccordionContent group={group} products={products} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
});

interface ItemEdits {
  quantity: number;
  product_id: number | null;
  supplier_id: number | null;
}

function OrderAccordionContent({
  group,
  products,
}: {
  group: OrderGroup;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<Record<number, ItemEdits>>({});
  const [deliveryDate, setDeliveryDate] = useState(group.delivery_date ?? "");
  const [productOpenId, setProductOpenId] = useState<number | null>(null);
  const [kpisEditId, setKpisEditId] = useState<number | null>(null);
  const [kpisNotes, setKpisNotes] = useState("");

  async function handleConfirm() {
    try {
      await confirmOrderAction(group.order_id);
      toast.success("주문이 확인되었습니다.");
    } catch {
      toast.error("주문 확인에 실패했습니다.");
    }
  }

  async function handleCancel() {
    try {
      await updateOrderStatusAction(group.order_id, "cancelled");
      toast.success("주문이 취소되었습니다.");
    } catch {
      toast.error("주문 취소에 실패했습니다.");
    }
  }

  function handleStartEdit() {
    const initial: Record<number, ItemEdits> = {};
    for (const item of group.items) {
      initial[item.id] = {
        quantity: item.quantity,
        product_id: item.product_id,
        supplier_id: item.supplier_id ?? null,
      };
    }
    setEditItems(initial);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditItems({});
  }

  function handleSaveItems() {
    startTransition(async () => {
      try {
        const updates: Promise<unknown>[] = [];
        for (const item of group.items) {
          const edits = editItems[item.id];
          if (!edits) continue;
          const changes: { quantity?: number; product_id?: number; supplier_id?: number | null } = {};
          if (edits.quantity !== item.quantity) changes.quantity = edits.quantity;
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

  function handleDeliveryDateChange(value: string) {
    setDeliveryDate(value);
    startTransition(async () => {
      try {
        await updateDeliveryDateAction(group.order_id, value || null);
        toast.success("배송일이 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("배송일 변경에 실패했습니다.");
      }
    });
  }

  function handleHospitalChange(hospitalId: number) {
    startTransition(async () => {
      try {
        await updateOrderHospitalAction(group.order_id, hospitalId);
        toast.success("거래처가 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("거래처 변경에 실패했습니다.");
      }
    });
  }

  function updateItemField(itemId: number, field: keyof ItemEdits, value: number | null) {
    setEditItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Order info summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">주문번호</span>
          <p className="font-medium">{group.order_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">주문일</span>
          <p>{group.order_date}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">거래처</span>
          <SearchableCombobox
            value={group.hospital_id}
            displayName={group.hospital_name}
            placeholder="거래처 선택"
            searchPlaceholder="거래처 검색..."
            onSelect={(id) => handleHospitalChange(id)}
            searchAction={searchHospitalsAction}
            className="w-[180px]"
          />
        </div>
        <div>
          <span className="text-muted-foreground text-xs">배송예정</span>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => handleDeliveryDateChange(e.target.value)}
            disabled={isPending}
            className="h-7 w-[140px] text-sm mt-0.5"
          />
        </div>
        <div>
          <span className="text-muted-foreground text-xs">상태</span>
          <div className="mt-0.5">
            <button
              className="relative flex h-7 w-[110px] rounded-full border text-[11px] font-medium overflow-hidden cursor-pointer transition-colors"
              onClick={async () => {
                const next = group.status === "delivered" ? "confirmed" : "delivered";
                try {
                  await updateOrderStatusAction(group.order_id, next);
                  toast.success(next === "delivered" ? "완료 처리됨" : "미완료로 변경됨");
                } catch { toast.error("상태 변경 실패"); }
              }}
            >
              <span className={`flex-1 flex items-center justify-center transition-all ${group.status === "confirmed" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>미완료</span>
              <span className={`flex-1 flex items-center justify-center transition-all ${group.status === "delivered" ? "bg-green-600 text-white" : "text-muted-foreground"}`}>완료</span>
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">
            주문 품목 ({group.items.length}건)
          </h4>
          {!isEditing ? (
            <Button size="sm" variant="ghost" onClick={handleStartEdit} className="h-7 text-xs">
              <Pencil className="h-3.5 w-3.5 mr-1" />
              수정
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveItems}
                disabled={isPending}
                className="h-7 text-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {isPending ? "저장중..." : "저장"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isPending}
                className="h-7 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                취소
              </Button>
            </div>
          )}
        </div>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">품목</TableHead>
                <TableHead className="text-xs text-right w-[60px]">수량</TableHead>
                <TableHead className="text-xs text-right w-[60px]">박스</TableHead>
                <TableHead className="text-xs w-[80px]">매입처</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매입단가</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매입총액</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매출단가</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매출총액</TableHead>
                <TableHead className="text-xs text-right w-[80px]">매출이익</TableHead>
                <TableHead className="text-xs text-right w-[60px]">이익률</TableHead>
                <TableHead className="text-xs w-[70px]">담당자</TableHead>
                <TableHead className="text-xs w-[80px]">KPIS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map((item) => (
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
                      <>
                        {item.product_name}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={editItems[item.id]?.quantity ?? item.quantity}
                        onChange={(e) =>
                          updateItemField(item.id, "quantity", Number(e.target.value))
                        }
                        className="h-7 w-[70px] text-right text-sm ml-auto"
                      />
                    ) : (
                      item.quantity.toLocaleString()
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.box_quantity != null ? item.box_quantity.toLocaleString() : "-"}
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
                    {item.purchase_price != null ? item.purchase_price.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.purchase_price != null ? (item.purchase_price * item.quantity).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.unit_price != null ? item.unit_price.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.unit_price != null ? (item.unit_price * item.quantity).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.unit_price != null && item.purchase_price != null ? (() => {
                      const profit = (item.unit_price - item.purchase_price) * item.quantity;
                      return <span className={profit < 0 ? "text-red-500" : "text-green-600"}>{profit.toLocaleString()}</span>;
                    })() : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.unit_price != null && item.purchase_price != null ? (() => {
                      const revenue = item.unit_price * item.quantity;
                      const profit = (item.unit_price - item.purchase_price) * item.quantity;
                      const rate = revenue > 0 ? (profit / revenue) * 100 : 0;
                      return <span className={rate < 0 ? "text-red-500" : ""}>{rate.toFixed(1)}%</span>;
                    })() : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.sales_rep ?? "-"}
                  </TableCell>
                  <TableCell>
                    {kpisEditId === item.id ? (
                      <div className="space-y-1">
                        <Select
                          defaultValue={item.kpis_status ?? "pending"}
                          onValueChange={(val: string) => {
                            startTransition(async () => {
                              try {
                                await upsertKpisReportAction(item.id, { report_status: val, notes: kpisNotes || undefined });
                                toast.success("KPIS 상태가 저장되었습니다.");
                                setKpisEditId(null);
                                router.refresh();
                              } catch { toast.error("KPIS 저장 실패"); }
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">미신고</SelectItem>
                            <SelectItem value="reported">신고완료</SelectItem>
                            <SelectItem value="confirmed">확인됨</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          placeholder="KPIS 메모..."
                          value={kpisNotes}
                          onChange={(e) => setKpisNotes(e.target.value)}
                          className="text-xs h-14 resize-none"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  await upsertKpisReportAction(item.id, { notes: kpisNotes || undefined });
                                  toast.success("KPIS 메모가 저장되었습니다.");
                                  setKpisEditId(null);
                                  router.refresh();
                                } catch { toast.error("KPIS 저장 실패"); }
                              });
                            }}
                          >
                            <Save className="h-3 w-3 mr-0.5" />저장
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setKpisEditId(null)}>
                            <X className="h-3 w-3 mr-0.5" />취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                          setKpisEditId(item.id);
                          setKpisNotes(item.kpis_notes ?? "");
                        }}
                      >
                        {item.kpis_status ? (
                          <Badge
                            variant={KPIS_VARIANT[item.kpis_status] ?? "secondary"}
                            className="text-xs cursor-pointer"
                          >
                            {KPIS_LABEL[item.kpis_status] ?? item.kpis_status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground hover:underline cursor-pointer">미등록</span>
                        )}
                        {item.kpis_notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[80px]">{item.kpis_notes}</p>
                        )}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              삭제
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>주문을 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                주문번호 {group.order_number}이(가) 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await deleteOrdersAction([group.order_id]);
                    toast.success("주문이 삭제되었습니다.");
                    router.refresh();
                  } catch {
                    toast.error("주문 삭제에 실패했습니다.");
                  }
                }}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  );
}
