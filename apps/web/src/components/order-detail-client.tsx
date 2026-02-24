"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CalendarCheck,
  Hash,
  Pencil,
  Save,
  Trash2,
  X,
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
  updateDeliveryDateAction,
  updateOrderItemAction,
  updateOrderStatusAction,
} from "@/app/(dashboard)/orders/actions";
import { toast } from "sonner";
import type { OrderDetail, OrderItem } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  confirmed: "default",
  processing: "default",
  delivered: "outline",
  cancelled: "destructive",
};

const DETAIL_COL_DEFAULTS: Record<string, number> = {
  idx: 40, product: 200, original: 150, quantity: 80, unit_price: 90, total: 90,
};

interface OrderDetailClientProps {
  order: OrderDetail;
}

export function OrderDetailClient({ order }: OrderDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { widths, onMouseDown } = useResizableColumns("order-detail", DETAIL_COL_DEFAULTS);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantities, setEditQuantities] = useState<Record<number, number>>(
    {},
  );
  const [deliveryDate, setDeliveryDate] = useState(
    order.delivery_date ?? "",
  );

  const isEditable = !["delivered", "cancelled"].includes(order.status);

  // --- Status actions ---

  function handleStatusChange(targetStatus: string) {
    startTransition(async () => {
      try {
        if (order.status === "draft" && targetStatus === "confirmed") {
          await confirmOrderAction(order.id);
        } else {
          await updateOrderStatusAction(order.id, targetStatus);
        }
        toast.success("주문 상태가 변경되었습니다.");
        router.refresh();
      } catch {
        toast.error("상태 변경에 실패했습니다.");
      }
    });
  }

  // --- Delete ---

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
    const initial: Record<number, number> = {};
    for (const item of order.items) {
      initial[item.id] = item.quantity;
    }
    setEditQuantities(initial);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditQuantities({});
  }

  function handleSaveItems() {
    startTransition(async () => {
      try {
        const updates: Promise<unknown>[] = [];
        for (const item of order.items) {
          const newQty = editQuantities[item.id];
          if (newQty !== undefined && newQty !== item.quantity) {
            updates.push(
              updateOrderItemAction(item.id, { quantity: newQty }),
            );
          }
        }
        if (updates.length === 0) {
          setIsEditing(false);
          return;
        }
        await Promise.all(updates);
        toast.success(`${updates.length}개 품목이 수정되었습니다.`);
        setIsEditing(false);
        setEditQuantities({});
        router.refresh();
      } catch {
        toast.error("수량 수정에 실패했습니다.");
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

  // --- Computed totals ---

  const supplyTotal = order.items.reduce(
    (sum, item) =>
      sum + (item.line_total ?? item.quantity * (item.unit_price ?? 0)),
    0,
  );
  const taxTotal = Math.round(supplyTotal * 0.1);

  return (
    <div className="space-y-4">
      {/* Order info metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
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
          <span className="text-sm">
            {order.delivered_at
              ? new Date(order.delivered_at).toLocaleDateString("ko-KR")
              : "-"}
          </span>
        </div>
      </div>

      {/* Status + action buttons row */}
      <div className="flex flex-wrap items-center gap-2">
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

        {/* Status progression buttons */}
        {order.status === "draft" && (
          <>
            <Button
              size="sm"
              onClick={() => handleStatusChange("confirmed")}
              disabled={isPending}
            >
              {isPending ? "처리중..." : "접수 확인"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleStatusChange("cancelled")}
              disabled={isPending}
            >
              주문 취소
            </Button>
          </>
        )}
        {order.status === "confirmed" && (
          <Button
            size="sm"
            onClick={() => handleStatusChange("processing")}
            disabled={isPending}
          >
            {isPending ? "처리중..." : "처리 시작 →"}
          </Button>
        )}
        {order.status === "processing" && (
          <Button
            size="sm"
            onClick={() => handleStatusChange("delivered")}
            disabled={isPending}
          >
            {isPending ? "처리중..." : "배송 완료 →"}
          </Button>
        )}

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

      <Separator />

      {/* Items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">
            주문 품목 ({order.items.length}건)
          </h4>
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
            ))}
        </div>
        <div className="overflow-x-auto -mx-6">
          <Table style={{ tableLayout: "fixed" }}>
            <TableHeader>
              <TableRow>
                <ResizableTh width={widths.idx} colKey="idx" onResizeStart={onMouseDown} className="pl-6">#</ResizableTh>
                <ResizableTh width={widths.product} colKey="product" onResizeStart={onMouseDown}>품목</ResizableTh>
                <ResizableTh width={widths.original} colKey="original" onResizeStart={onMouseDown} className="hidden sm:table-cell print:table-cell">원문</ResizableTh>
                <ResizableTh width={widths.quantity} colKey="quantity" onResizeStart={onMouseDown} className="text-right">수량</ResizableTh>
                <ResizableTh width={widths.unit_price} colKey="unit_price" onResizeStart={onMouseDown} className="text-right">단가</ResizableTh>
                <ResizableTh width={widths.total} colKey="total" onResizeStart={onMouseDown} className="text-right pr-6">금액</ResizableTh>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, idx) => {
                const itemAny = item as unknown as Record<string, unknown>;
                const productName = itemAny.products
                  ? (itemAny.products as { name: string }).name
                  : `제품 #${item.product_id ?? "미매칭"}`;
                const qty = isEditing
                  ? (editQuantities[item.id] ?? item.quantity)
                  : item.quantity;
                const lineTotal =
                  item.line_total ?? qty * (item.unit_price ?? 0);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{productName}</span>
                      {item.match_status !== "matched" && (
                        <Badge variant="outline" className="text-xs ml-2">
                          {item.match_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell print:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                      {item.original_text || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          value={editQuantities[item.id] ?? item.quantity}
                          onChange={(e) =>
                            setEditQuantities((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className="h-7 w-[70px] text-right text-sm ml-auto"
                        />
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(item.unit_price ?? 0).toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right pr-6 tabular-nums font-medium">
                      {lineTotal.toLocaleString("ko-KR")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      {supplyTotal > 0 && (
        <>
          <Separator />
          <div className="flex justify-end">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground text-right">공급가액</span>
              <span className="text-right tabular-nums">
                {supplyTotal.toLocaleString("ko-KR")}원
              </span>
              <span className="text-muted-foreground text-right">
                세액 (10%)
              </span>
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
    </div>
  );
}
