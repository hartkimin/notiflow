"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  ChevronsUpDown,
  Hash,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  Copy,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn, round4, fmt4 } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import {
  confirmOrderAction,
  deleteOrdersAction,
  deleteOrderItemAction,
  addOrderItemAction,
  updateOrderTotalsAction,
  updateDeliveredAtAction,
  updateDeliveryDateAction,
  updateOrderItemAction,
  updateOrderStatusAction,
  createOrderCommentAction,
  deleteOrderCommentAction,
} from "@/app/(dashboard)/orders/actions";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";
import { createInvoiceFromOrder } from "@/lib/tax-invoice/service";
import type { TaxInvoice } from "@/lib/tax-invoice/types";
import type { OrderDetail, OrderComment, Product } from "@/lib/types";
import { ORDER_STATUS_LABELS as STATUS_LABELS } from "@/lib/order-status";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  confirmed: "default",
  delivered: "outline",
  invoiced: "default",
  cancelled: "destructive",
};

interface NewItemState {
  key: string;
  product_id: number | null;
  product_name: string;
  supplier_id: number | null;
  quantity: number;
  unit_type: string;
  unit_price: number;
  purchase_price: number;
  sales_rep: string;
}

let _newItemKey = 0;
function nextNewItemKey() { return `new-${Date.now()}-${++_newItemKey}`; }

function createBlankItem(): NewItemState {
  return {
    key: nextNewItemKey(),
    product_id: null,
    product_name: "",
    supplier_id: null,
    quantity: 1,
    unit_type: "개",
    unit_price: 0,
    purchase_price: 0,
    sales_rep: "",
  };
}

const DETAIL_COL_DEFAULTS: Record<string, number> = {
  idx: 35, product: 150, supplier: 80, quantity: 50, unit_type: 45,
  p_vat: 90, p_excl: 80, p_supply: 90, p_tax: 70,
  s_vat: 90, s_excl: 80, s_supply: 90, s_tax: 70,
  profit: 90, profit_rate: 55, sales_rep: 65,
};

interface EditItemState {
  quantity: number;
  unit_price: number;
  purchase_price: number;
  product_id: number | null;
  supplier_id: number | null;
  sales_rep: string;
}

interface SupplierOption {
  id: number;
  name: string;
}

interface OrderDetailClientProps {
  order: OrderDetail;
  products: Product[];
  suppliers?: SupplierOption[];
  comments?: OrderComment[];
  linkedInvoices?: TaxInvoice[];
}

const INVOICE_STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "secondary", label: "임시" },
  issued: { variant: "default", label: "발행" },
  sent: { variant: "default", label: "전송" },
  cancelled: { variant: "destructive", label: "취소" },
};

export function OrderDetailClient({ order, products, suppliers = [], comments = [], linkedInvoices = [] }: OrderDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { widths, onMouseDown } = useResizableColumns("order-detail", DETAIL_COL_DEFAULTS);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<Record<number, EditItemState>>({});
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [newItems, setNewItems] = useState<NewItemState[]>([]);
  const [productOpenId, setProductOpenId] = useState<number | null>(null);
  const [supplierOpenId, setSupplierOpenId] = useState<number | null>(null);
  const [showMfdsSearch, setShowMfdsSearch] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    order.delivery_date ?? "",
  );
  const [deliveredAt, setDeliveredAt] = useState(
    order.delivered_at ? order.delivered_at.slice(0, 10) : "",
  );
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Manual total overrides (null = use calculated value)
  const [manualPurchaseTotal, setManualPurchaseTotal] = useState<number | null>(null);
  const [manualSalesTotal, setManualSalesTotal] = useState<number | null>(null);
  const [manualSupply, setManualSupply] = useState<number | null>(order.supply_amount);
  const [manualTax, setManualTax] = useState<number | null>(order.tax_amount);
  const [totalsEditing, setTotalsEditing] = useState(false);

  const isEditable = true; // Both statuses are editable
  const canCreateInvoice = order.status === "confirmed" || order.status === "delivered";

  // --- Status actions ---

  function handleStatusChange(targetStatus: string) {
    startTransition(async () => {
      try {
        await updateOrderStatusAction(order.id, targetStatus);
        toast.success("주문 상태가 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("상태 변경에 실패했습니다.");
      }
    });
  }

  // --- Delete order ---

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteOrdersAction([order.id]);
        toast.success("주문이 삭제되었습니다.");
        router.replace("/orders");
      } catch {
        toast.error("주문 삭제에 실패했습니다.");
      }
    });
  }

  // --- Inline item editing ---

  function handleStartEdit() {
    const initial: Record<number, EditItemState> = {};
    for (const item of order.items) {
      initial[item.id] = {
        quantity: item.quantity,
        unit_price: item.unit_price ?? 0,
        purchase_price: item.purchase_price ?? 0,
        product_id: item.product_id,
        supplier_id: item.supplier_id,
        sales_rep: item.sales_rep ?? "",
      };
    }
    setEditItems(initial);
    setDeletedIds(new Set());
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditItems({});
    setDeletedIds(new Set());
    setNewItems([]);
  }

  function updateEditItem(itemId: number, field: keyof EditItemState, value: number | string | null) {
    setEditItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  function handleProductChange(itemId: number, productIdStr: string) {
    const pid = Number(productIdStr);
    updateEditItem(itemId, "product_id", pid);
    // Auto-fill unit_price from product
    const product = products.find((p) => p.id === pid);
    if (product?.unit_price) {
      updateEditItem(itemId, "unit_price", product.unit_price);
    }
  }

  function markItemDeleted(itemId: number) {
    setDeletedIds((prev) => new Set(prev).add(itemId));
  }

  function unmarkItemDeleted(itemId: number) {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }

  function addNewItem() {
    setNewItems((prev) => [...prev, createBlankItem()]);
  }

  function updateNewItem(key: string, field: keyof NewItemState, value: unknown) {
    setNewItems((prev) =>
      prev.map((item) => item.key === key ? { ...item, [field]: value } : item),
    );
  }

  function removeNewItem(key: string) {
    setNewItems((prev) => prev.filter((item) => item.key !== key));
  }

  function handleNewItemProductChange(key: string, productIdStr: string) {
    const pid = Number(productIdStr);
    const product = products.find((p) => p.id === pid);
    setNewItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              product_id: pid,
              product_name: product?.official_name ?? product?.name ?? "",
              unit_price: product?.unit_price ?? item.unit_price,
            }
          : item,
      ),
    );
  }

  function handleSaveTotals() {
    startTransition(async () => {
      try {
        await updateOrderTotalsAction(order.id, {
          supply_amount: finalSupply,
          tax_amount: finalTax,
          total_amount: finalSupply + finalTax,
        });
        toast.success("합계가 저장되었습니다.");
        setTotalsEditing(false);
        router.refresh();
      } catch {
        toast.error("합계 저장에 실패했습니다.");
      }
    });
  }

  function handleSaveItems() {
    startTransition(async () => {
      try {
        const ops: Promise<unknown>[] = [];

        // Delete items
        for (const id of deletedIds) {
          ops.push(deleteOrderItemAction(id));
        }

        // Update changed items (skip deleted ones)
        for (const item of order.items) {
          if (deletedIds.has(item.id)) continue;
          const rawEdit = editItems[item.id];
          if (!rawEdit) continue;

          const edit = rawEdit;

          const changes: { quantity?: number; unit_price?: number; purchase_price?: number; product_id?: number; supplier_id?: number | null; sales_rep?: string } = {};
          if (edit.quantity !== item.quantity) changes.quantity = edit.quantity;
          if (edit.unit_price !== (item.unit_price ?? 0)) changes.unit_price = edit.unit_price;
          if (edit.purchase_price !== (item.purchase_price ?? 0)) changes.purchase_price = edit.purchase_price;
          if (edit.product_id !== item.product_id && edit.product_id !== null) {
            changes.product_id = edit.product_id;
          }
          if (edit.supplier_id !== item.supplier_id) {
            changes.supplier_id = edit.supplier_id;
          }
          if (edit.sales_rep !== (item.sales_rep ?? "")) {
            changes.sales_rep = edit.sales_rep;
          }
          if (Object.keys(changes).length > 0) {
            ops.push(updateOrderItemAction(item.id, changes));
          }
        }

        // Add new items
        const validNewItems = newItems.filter((ni) => ni.product_name.trim());
        for (const ni of validNewItems) {
          ops.push(addOrderItemAction({
            order_id: order.id,
            product_id: ni.product_id,
            product_name: ni.product_name,
            supplier_id: ni.supplier_id,
            quantity: ni.quantity,
            unit_type: ni.unit_type,
            unit_price: ni.unit_price || null,
            purchase_price: ni.purchase_price || null,
            sales_rep: ni.sales_rep || null,
          }));
        }

        if (ops.length === 0) {
          setIsEditing(false);
          return;
        }
        await Promise.all(ops);
        const delCount = deletedIds.size;
        const addCount = validNewItems.length;
        const updateCount = ops.length - delCount - addCount;
        const parts: string[] = [];
        if (addCount > 0) parts.push(`${addCount}개 추가`);
        if (updateCount > 0) parts.push(`${updateCount}개 수정`);
        if (delCount > 0) parts.push(`${delCount}개 삭제`);
        toast.success(`품목 ${parts.join(", ")} 완료`);
        setIsEditing(false);
        setEditItems({});
        setDeletedIds(new Set());
        setNewItems([]);
        router.refresh();
      } catch {
        toast.error("품목 수정에 실패했습니다.");
      }
    });
  }

  // --- Delivery date ---

  function handleDeliveryDateChange(value: string) {
    setDeliveryDate(value);
    startTransition(async () => {
      try {
        await updateDeliveryDateAction(order.id, value || null);
        toast.success("배송예정일이 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("배송예정일 변경에 실패했습니다.");
      }
    });
  }

  function handleDeliveredAtChange(value: string) {
    setDeliveredAt(value);
    startTransition(async () => {
      try {
        await updateDeliveredAtAction(order.id, value || null);
        toast.success("실제 배송일이 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("실제 배송일 변경에 실패했습니다.");
      }
    });
  }

  // --- Invoice creation ---

  function handleCreateInvoice() {
    startTransition(async () => {
      try {
        await createInvoiceFromOrder(order.id, invoiceIssueDate);
        toast.success("세금계산서가 생성되었습니다.");
        setInvoiceDialogOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "세금계산서 생성에 실패했습니다.");
      }
    });
  }

  // --- Computed totals ---
  const visibleItems = order.items.filter((item) => !deletedIds.has(item.id));

  const purchaseTotal = visibleItems.reduce((sum, item) => {
    const edit = editItems[item.id];
    const qty = edit?.quantity ?? item.quantity;
    const pp = edit?.purchase_price ?? (item.purchase_price ?? 0);
    return sum + round4(pp * 1.1) * qty;
  }, 0);

  const salesTotal = visibleItems.reduce((sum, item) => {
    const edit = editItems[item.id];
    const qty = edit ? edit.quantity : item.quantity;
    const sp = edit ? edit.unit_price : (item.unit_price ?? 0);
    return sum + round4(sp * 1.1) * qty;
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

  // Final values: manual override takes precedence
  const finalPurchaseTotal = manualPurchaseTotal ?? purchaseTotal;
  const finalSalesTotal = manualSalesTotal ?? salesTotal;
  const finalSupply = manualSupply ?? supplyTotal;
  const finalTax = manualTax ?? taxTotal;
  const totalMargin = finalSalesTotal - finalPurchaseTotal;
  const marginRate = finalSalesTotal > 0 ? (totalMargin / finalSalesTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Order info metadata — hidden on print (shown in print header) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm print:hidden">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{order.hospital_name}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>주문 {order.order_date}</span>
        </div>
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>배송예정</span>
          </div>
          {isEditable ? (
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => handleDeliveryDateChange(e.target.value)}
              disabled={isPending}
              className="h-7 w-[140px] text-sm"
            />
          ) : (
            <span className="text-sm">
              {order.delivery_date || "-"}
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
            <span>실제 배송일</span>
          </div>
          <Input
            type="date"
            value={deliveredAt}
            onChange={(e) => handleDeliveredAtChange(e.target.value)}
            disabled={isPending}
            className="h-7 w-[140px] text-sm"
          />
        </div>
      </div>

      {/* Status + action buttons row — hidden on print */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Badge
          variant={STATUS_VARIANT[order.status] ?? "secondary"}
          className="text-sm"
        >
          {STATUS_LABELS[order.status] || order.status}
        </Badge>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          <span>{order.items.length}건</span>
        </div>

        <div className="flex-1" />

        {/* Status toggle */}
        <button
          className="relative flex h-7 w-[110px] rounded-full border text-[11px] font-medium overflow-hidden cursor-pointer transition-colors disabled:opacity-50"
          disabled={isPending}
          onClick={() => handleStatusChange(order.status === "delivered" ? "confirmed" : "delivered")}
        >
          <span className={`flex-1 flex items-center justify-center transition-all ${order.status === "confirmed" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>미완료</span>
          <span className={`flex-1 flex items-center justify-center transition-all ${order.status === "delivered" ? "bg-green-600 text-white" : "text-muted-foreground"}`}>완료</span>
        </button>

        {/* Copy order */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/orders/new?copy_from=${order.id}`)}
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          복사
        </Button>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              삭제
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>주문을 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                주문번호 {order.order_number}이(가) 영구적으로 삭제됩니다. 이
                작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Separator className="print:hidden" />

      {/* Items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium print:text-base print:font-semibold">
            주문 품목 ({order.items.length}건)
          </h4>
          <div className="flex items-center gap-1 print:hidden">
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMfdsSearch(!showMfdsSearch)}
                className="h-7 text-xs"
              >
                식약처 검색
              </Button>
            )}
            {isEditable &&
              (!isEditing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStartEdit}
                  className="h-7 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  수정
                </Button>
              ) : (
                <>
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
                </>
              ))}
          </div>
        </div>
        {showMfdsSearch && (
          <div className="border rounded-lg p-4 space-y-2 mb-2 print:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">식약처 품목 검색</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowMfdsSearch(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <MfdsSearchPanel
              mode="pick"
              onSelect={(_productId) => {
                setShowMfdsSearch(false);
                toast.success("품목이 추가되었습니다. 주문 항목에서 선택할 수 있습니다.");
                router.refresh();
              }}
            />
          </div>
        )}
        <div className="overflow-x-auto -mx-6">
          <Table style={{ tableLayout: "fixed" }}>
            <TableHeader>
              <TableRow>
                <ResizableTh width={widths.idx} colKey="idx" onResizeStart={onMouseDown} className="pl-6">#</ResizableTh>
                <ResizableTh width={widths.product} colKey="product" onResizeStart={onMouseDown}>품목</ResizableTh>
                <ResizableTh width={widths.supplier} colKey="supplier" onResizeStart={onMouseDown}>매입처</ResizableTh>
                <ResizableTh width={widths.quantity} colKey="quantity" onResizeStart={onMouseDown} className="text-right">수량</ResizableTh>
                <ResizableTh width={widths.unit_type} colKey="unit_type" onResizeStart={onMouseDown}>단위</ResizableTh>
                <ResizableTh width={widths.p_vat} colKey="p_vat" onResizeStart={onMouseDown} className="text-right">매입(VAT)</ResizableTh>
                <ResizableTh width={widths.p_excl} colKey="p_excl" onResizeStart={onMouseDown} className="text-right">매입단가</ResizableTh>
                <ResizableTh width={widths.p_supply} colKey="p_supply" onResizeStart={onMouseDown} className="text-right">매입공급가</ResizableTh>
                <ResizableTh width={widths.p_tax} colKey="p_tax" onResizeStart={onMouseDown} className="text-right">매입부가세</ResizableTh>
                <ResizableTh width={widths.s_vat} colKey="s_vat" onResizeStart={onMouseDown} className="text-right">판매(VAT)</ResizableTh>
                <ResizableTh width={widths.s_excl} colKey="s_excl" onResizeStart={onMouseDown} className="text-right">판매단가</ResizableTh>
                <ResizableTh width={widths.s_supply} colKey="s_supply" onResizeStart={onMouseDown} className="text-right">판매공급가</ResizableTh>
                <ResizableTh width={widths.s_tax} colKey="s_tax" onResizeStart={onMouseDown} className="text-right">판매부가세</ResizableTh>
                <ResizableTh width={widths.profit} colKey="profit" onResizeStart={onMouseDown} className="text-right">매출이익</ResizableTh>
                <ResizableTh width={widths.profit_rate} colKey="profit_rate" onResizeStart={onMouseDown} className="text-right">이익률</ResizableTh>
                <ResizableTh width={widths.sales_rep} colKey="sales_rep" onResizeStart={onMouseDown} className="pr-6">담당자</ResizableTh>
                {isEditing && <th className="w-[40px] print:hidden" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, idx) => {
                const isDeleted = deletedIds.has(item.id);
                const productName = item.products?.official_name || item.products?.name
                  || item.product_name
                  || `제품 #${item.product_id ?? "미매칭"}`;

                const edit = editItems[item.id];
                const qty = edit ? edit.quantity : item.quantity;
                const pp = edit ? edit.purchase_price : (item.purchase_price ?? 0);
                const sp = edit ? edit.unit_price : (item.unit_price ?? 0);
                const ppVat = round4(pp * 1.1);
                const spVat = round4(sp * 1.1);
                const pSupply = round4(pp * qty);
                const pTax = round4(pSupply * 0.1);
                const sSupply = round4(sp * qty);
                const sTax = round4(sSupply * 0.1);
                const lineProfit = round4(sSupply + sTax) - round4(pSupply + pTax);
                const lineSalesVatTotal = round4(sSupply + sTax);
                const lineMargin = lineSalesVatTotal > 0 ? (lineProfit / lineSalesVatTotal) * 100 : 0;

                return (
                  <TableRow
                    key={item.id}
                    className={isDeleted ? "opacity-30 line-through" : undefined}
                  >
                    <TableCell className="pl-6 text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      {isEditing && !isDeleted ? (
                        <Popover
                          open={productOpenId === item.id}
                          onOpenChange={(open: boolean) => setProductOpenId(open ? item.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={productOpenId === item.id}
                              className="w-full justify-between font-normal h-7 text-xs"
                            >
                              <span className="truncate">
                                {(() => {
                                  const pid = edit?.product_id ?? item.product_id;
                                  const found = products.find((p) => p.id === pid);
                                  return found ? found.name : (item.product_name || productName);
                                })()}
                              </span>
                              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="품목명, 제조사 검색..." />
                              <CommandList>
                                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={`${p.name} ${p.official_name ?? ""} ${p.short_name ?? ""} ${p.manufacturer ?? ""} ${p.category ?? ""}`}
                                      onSelect={() => {
                                        handleProductChange(item.id, String(p.id));
                                        setProductOpenId(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-3 w-3 shrink-0",
                                          (edit?.product_id ?? item.product_id) === p.id ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate text-xs">{p.name}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">
                                          {[p.manufacturer, p.category].filter(Boolean).join(" · ")}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="font-medium">{productName}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isEditing && !isDeleted ? (
                        <Popover
                          open={supplierOpenId === item.id}
                          onOpenChange={(open: boolean) => setSupplierOpenId(open ? item.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-7 text-xs"
                            >
                              <span className="truncate">
                                {(() => {
                                  const sid = edit?.supplier_id ?? item.supplier_id;
                                  const found = suppliers.find((s) => s.id === sid);
                                  return found ? found.name : "매입처 선택...";
                                })()}
                              </span>
                              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="매입처명 검색..." />
                              <CommandList>
                                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                                <CommandGroup>
                                  {suppliers.map((s) => (
                                    <CommandItem
                                      key={s.id}
                                      value={s.name}
                                      onSelect={() => {
                                        updateEditItem(item.id, "supplier_id", s.id);
                                        setSupplierOpenId(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-3 w-3 shrink-0",
                                          (edit?.supplier_id ?? item.supplier_id) === s.id ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <span className="truncate text-xs">{s.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        item.suppliers?.name ?? "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input
                          type="number"
                          min={0}
                          value={edit?.quantity ?? item.quantity}
                          onChange={(e) =>
                            updateEditItem(item.id, "quantity", Number(e.target.value))
                          }
                          className="h-7 w-[50px] text-right text-sm ml-auto"
                        />
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.unit_type ?? "piece"}
                    </TableCell>
                    {/* 매입(VAT) — 입력 */}
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0} step="any"
                          value={ppVat}
                          onChange={(e) => {
                            const v = e.target.value ? parseFloat(e.target.value) : 0;
                            updateEditItem(item.id, "purchase_price", round4(v / 1.1));
                          }}
                          className="h-7 w-[80px] text-right text-sm ml-auto"
                        />
                      ) : (
                        pp > 0 ? fmt4(ppVat) : "-"
                      )}
                    </TableCell>
                    {/* 매입단가 — 자동 */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pp > 0 ? fmt4(pp) : "-"}
                    </TableCell>
                    {/* 매입공급가 — 자동 */}
                    <TableCell className="text-right tabular-nums">
                      {pp > 0 ? fmt4(pSupply) : "-"}
                    </TableCell>
                    {/* 매입부가세 — 자동 */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pp > 0 ? fmt4(pTax) : "-"}
                    </TableCell>
                    {/* 판매(VAT) — 입력 */}
                    <TableCell className="text-right tabular-nums">
                      {isEditing && !isDeleted ? (
                        <Input type="number" min={0} step="any"
                          value={spVat}
                          onChange={(e) => {
                            const v = e.target.value ? parseFloat(e.target.value) : 0;
                            updateEditItem(item.id, "unit_price", round4(v / 1.1));
                          }}
                          className="h-7 w-[80px] text-right text-sm ml-auto"
                        />
                      ) : (
                        sp > 0 ? fmt4(spVat) : "-"
                      )}
                    </TableCell>
                    {/* 판매단가 — 자동 */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {sp > 0 ? fmt4(sp) : "-"}
                    </TableCell>
                    {/* 판매공급가 — 자동 */}
                    <TableCell className="text-right tabular-nums font-medium">
                      {sp > 0 ? fmt4(sSupply) : "-"}
                    </TableCell>
                    {/* 판매부가세 — 자동 */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {sp > 0 ? fmt4(sTax) : "-"}
                    </TableCell>
                    {/* 매출이익 */}
                    <TableCell className="text-right tabular-nums">
                      {sp > 0 && pp > 0 ? (
                        <span className={lineProfit < 0 ? "text-red-500" : "text-green-600"}>
                          {fmt4(lineProfit)}
                        </span>
                      ) : "-"}
                    </TableCell>
                    {/* 이익률 */}
                    <TableCell className="text-right tabular-nums">
                      {lineSalesVatTotal > 0 ? (
                        <span className={lineMargin < 0 ? "text-red-500" : ""}>
                          {lineMargin.toFixed(1)}%
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {isEditing && !isDeleted ? (
                        <Input
                          value={edit?.sales_rep ?? item.sales_rep ?? ""}
                          onChange={(e) => updateEditItem(item.id, "sales_rep", e.target.value)}
                          className="h-7 w-full text-sm"
                        />
                      ) : (
                        item.sales_rep ?? "-"
                      )}
                    </TableCell>
                    {isEditing && (
                      <TableCell className="px-1 print:hidden">
                        {isDeleted ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => unmarkItemDeleted(item.id)}
                            title="삭제 취소"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => markItemDeleted(item.id)}
                            title="품목 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {/* New items rows */}
              {isEditing && newItems.map((ni) => {
                const niPpVat = round4(ni.purchase_price * 1.1);
                const niSpVat = round4(ni.unit_price * 1.1);
                const niPSupply = round4(ni.purchase_price * ni.quantity);
                const niPTax = round4(niPSupply * 0.1);
                const niSSupply = round4(ni.unit_price * ni.quantity);
                const niSTax = round4(niSSupply * 0.1);
                const niProfit = round4(niSSupply + niSTax) - round4(niPSupply + niPTax);
                const niSalesVatTotal = round4(niSSupply + niSTax);
                const niMargin = niSalesVatTotal > 0 ? (niProfit / niSalesVatTotal) * 100 : 0;
                return (
                <TableRow key={ni.key} className="bg-green-50/50">
                  {/* # */}
                  <TableCell className="pl-6 text-green-600 font-bold text-xs">+</TableCell>
                  {/* 품목 */}
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-7 text-xs">
                          <span className="truncate">{ni.product_name || "품목 선택..."}</span>
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="품목명, 제조사 검색..." />
                          <CommandList>
                            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                            <CommandGroup>
                              {products.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.official_name ?? ""} ${p.short_name ?? ""} ${p.manufacturer ?? ""}`}
                                  onSelect={() => handleNewItemProductChange(ni.key, String(p.id))}
                                >
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate text-xs">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {[p.manufacturer, p.category].filter(Boolean).join(" · ")}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  {/* 매입처 */}
                  <TableCell className="text-sm">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-7 text-xs">
                          <span className="truncate">{suppliers.find((s) => s.id === ni.supplier_id)?.name || "매입처 선택..."}</span>
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="매입처명 검색..." />
                          <CommandList>
                            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                            <CommandGroup>
                              {suppliers.map((s) => (
                                <CommandItem key={s.id} value={s.name} onSelect={() => updateNewItem(ni.key, "supplier_id", s.id)}>
                                  <span className="truncate text-xs">{s.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  {/* 수량 */}
                  <TableCell className="text-right tabular-nums">
                    <Input type="number" min={0} step="any" value={ni.quantity} onChange={(e) => updateNewItem(ni.key, "quantity", Number(e.target.value) || 0)} className="h-7 w-[50px] text-right text-sm ml-auto" />
                  </TableCell>
                  {/* 단위 */}
                  <TableCell className="text-sm text-muted-foreground">{ni.unit_type}</TableCell>
                  {/* 매입(VAT) — 입력 */}
                  <TableCell className="text-right tabular-nums">
                    <Input type="number" min={0} step="any" value={niPpVat} onChange={(e) => { const v = e.target.value ? parseFloat(e.target.value) : 0; updateNewItem(ni.key, "purchase_price", round4(v / 1.1)); }} className="h-7 w-[80px] text-right text-sm ml-auto" />
                  </TableCell>
                  {/* 매입단가 — 자동 */}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {ni.purchase_price > 0 ? fmt4(ni.purchase_price) : "-"}
                  </TableCell>
                  {/* 매입공급가 — 자동 */}
                  <TableCell className="text-right tabular-nums">
                    {ni.purchase_price > 0 ? fmt4(niPSupply) : "-"}
                  </TableCell>
                  {/* 매입부가세 — 자동 */}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {ni.purchase_price > 0 ? fmt4(niPTax) : "-"}
                  </TableCell>
                  {/* 판매(VAT) — 입력 */}
                  <TableCell className="text-right tabular-nums">
                    <Input type="number" min={0} step="any" value={niSpVat} onChange={(e) => { const v = e.target.value ? parseFloat(e.target.value) : 0; updateNewItem(ni.key, "unit_price", round4(v / 1.1)); }} className="h-7 w-[80px] text-right text-sm ml-auto" />
                  </TableCell>
                  {/* 판매단가 — 자동 */}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {ni.unit_price > 0 ? fmt4(ni.unit_price) : "-"}
                  </TableCell>
                  {/* 판매공급가 — 자동 */}
                  <TableCell className="text-right tabular-nums font-medium">
                    {ni.unit_price > 0 ? fmt4(niSSupply) : "-"}
                  </TableCell>
                  {/* 판매부가세 — 자동 */}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {ni.unit_price > 0 ? fmt4(niSTax) : "-"}
                  </TableCell>
                  {/* 매출이익 */}
                  <TableCell className="text-right tabular-nums">
                    {ni.unit_price > 0 && ni.purchase_price > 0 ? (
                      <span className={niProfit < 0 ? "text-red-500" : "text-green-600"}>{fmt4(niProfit)}</span>
                    ) : "-"}
                  </TableCell>
                  {/* 이익률 */}
                  <TableCell className="text-right tabular-nums">
                    {niSalesVatTotal > 0 ? (
                      <span className={niMargin < 0 ? "text-red-500" : ""}>{niMargin.toFixed(1)}%</span>
                    ) : "-"}
                  </TableCell>
                  {/* 담당자 */}
                  <TableCell className="pr-6">
                    <Input className="h-7 w-full text-sm" value={ni.sales_rep} onChange={(e) => updateNewItem(ni.key, "sales_rep", e.target.value)} />
                  </TableCell>
                  {/* 삭제 */}
                  <TableCell className="px-1 print:hidden">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeNewItem(ni.key)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
              {/* Add new item button */}
              {isEditing && (
                <TableRow>
                  <TableCell colSpan={isEditing ? 15 : 14} className="print:hidden">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700 gap-1" onClick={addNewItem}>
                      <Plus className="h-3.5 w-3.5" />
                      품목 추가
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      {(salesTotal > 0 || finalSalesTotal > 0) && (
        <>
          <Separator />
          <div className="flex justify-end items-start gap-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground text-right">매입합계</span>
              {totalsEditing ? (
                <Input type="number" step="any" className="h-7 w-[160px] text-right text-sm" value={finalPurchaseTotal} onChange={(e) => setManualPurchaseTotal(Number(e.target.value) || 0)} />
              ) : (
                <span className="text-right tabular-nums">{finalPurchaseTotal.toLocaleString()}원</span>
              )}
              <span className="text-muted-foreground text-right">매출합계</span>
              {totalsEditing ? (
                <Input type="number" step="any" className="h-7 w-[160px] text-right text-sm" value={finalSalesTotal} onChange={(e) => setManualSalesTotal(Number(e.target.value) || 0)} />
              ) : (
                <span className="text-right tabular-nums font-medium">{finalSalesTotal.toLocaleString()}원</span>
              )}
              <span className="text-muted-foreground text-right">마진</span>
              <span className={cn("text-right tabular-nums", totalMargin >= 0 ? "text-green-600" : "text-red-500")}>
                {totalMargin.toLocaleString()}원 ({finalSalesTotal > 0 ? marginRate.toFixed(1) : "-"}%)
              </span>
              <Separator className="col-span-2 my-1" />
              <span className="text-muted-foreground text-right">공급가액</span>
              {totalsEditing ? (
                <Input type="number" step="any" className="h-7 w-[160px] text-right text-sm" value={finalSupply} onChange={(e) => setManualSupply(Number(e.target.value) || 0)} />
              ) : (
                <span className="text-right tabular-nums">{finalSupply.toLocaleString()}원</span>
              )}
              <span className="text-muted-foreground text-right">세액</span>
              {totalsEditing ? (
                <Input type="number" step="any" className="h-7 w-[160px] text-right text-sm" value={finalTax} onChange={(e) => setManualTax(Number(e.target.value) || 0)} />
              ) : (
                <span className="text-right tabular-nums">{finalTax.toLocaleString()}원</span>
              )}
              <span className="font-semibold text-right">합계</span>
              <span className="font-semibold text-right tabular-nums">
                {(finalSupply + finalTax).toLocaleString()}원
              </span>
            </div>
            <div className="flex flex-col gap-1 print:hidden">
              {totalsEditing ? (
                <>
                  <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleSaveTotals} disabled={isPending}>
                    <Save className="h-3 w-3" />저장
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                    setTotalsEditing(false);
                    setManualPurchaseTotal(null);
                    setManualSalesTotal(null);
                    setManualSupply(order.supply_amount);
                    setManualTax(order.tax_amount);
                  }}>
                    취소
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => {
                  setManualPurchaseTotal(finalPurchaseTotal);
                  setManualSalesTotal(finalSalesTotal);
                  setManualSupply(finalSupply);
                  setManualTax(finalTax);
                  setTotalsEditing(true);
                }}>
                  <Pencil className="h-3 w-3" />수정
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tax invoice section */}
      {(canCreateInvoice || order.status === "invoiced") && (
        <>
          <Separator className="print:hidden" />
          <div className="space-y-3 print:hidden">
            <h4 className="text-sm font-medium">세금계산서</h4>
            {linkedInvoices.length > 0 && (
              <div className="space-y-2">
                {linkedInvoices.map((inv) => {
                  const badge = INVOICE_STATUS_BADGE[inv.status] ?? { variant: "secondary" as const, label: inv.status };
                  return (
                    <div key={inv.id} className="flex items-center gap-3 text-sm border rounded-md p-2.5">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                      <span className="text-muted-foreground">{inv.issue_date}</span>
                      <span className="ml-auto tabular-nums font-medium">
                        {inv.total_amount.toLocaleString()}원
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {canCreateInvoice && linkedInvoices.length === 0 && (
              <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">세금계산서 발행</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[360px]">
                  <DialogHeader>
                    <DialogTitle>세금계산서 발행</DialogTitle>
                    <DialogDescription>
                      주문 {order.order_number}에 대한 세금계산서를 생성합니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2 py-2">
                    <Label htmlFor="invoice-issue-date">작성일자</Label>
                    <Input
                      id="invoice-issue-date"
                      type="date"
                      value={invoiceIssueDate}
                      onChange={(e) => setInvoiceIssueDate(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreateInvoice}
                      disabled={isPending || !invoiceIssueDate}
                    >
                      {isPending ? "생성중..." : "생성"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </>
      )}

      {/* Comments section */}
      <Separator className="print:hidden" />
      <div className="space-y-3 print:hidden">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <MessageSquareText className="h-4 w-4" />
          코멘트 ({comments.length})
        </h4>
        {comments.length > 0 && (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm rounded-md border p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="whitespace-pre-wrap">{c.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(c.created_at).toLocaleString("ko-KR", {
                      month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteOrderCommentAction(c.id, order.id);
                        toast.success("코멘트가 삭제되었습니다.");
                        router.refresh();
                      } catch {
                        toast.error("코멘트 삭제에 실패했습니다.");
                      }
                    });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!commentText.trim()) return;
            const text = commentText.trim();
            setCommentText("");
            startTransition(async () => {
              try {
                await createOrderCommentAction(order.id, text);
                toast.success("코멘트가 추가되었습니다.");
                router.refresh();
              } catch {
                toast.error("코멘트 추가에 실패했습니다.");
              }
            });
          }}
        >
          <Textarea
            placeholder="코멘트 입력..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 resize-none h-16 text-sm"
          />
          <Button type="submit" size="sm" disabled={isPending || !commentText.trim()} className="shrink-0 self-end">
            {isPending ? "저장중..." : "등록"}
          </Button>
        </form>
      </div>
    </div>
  );
}
