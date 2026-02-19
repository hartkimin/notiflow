"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderDetail } from "@/components/order-detail";
import type { OrderItemFlat } from "@/lib/types";

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

function formatMMDD(dateStr: string | null): string {
  if (!dateStr) return "-";
  // ISO date: "2026-02-19" → "02/19"
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}

export function OrderTable({ items }: { items: OrderItemFlat[] }) {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">발주일</TableHead>
              <TableHead className="w-[70px]">배송일</TableHead>
              <TableHead>병원명</TableHead>
              <TableHead>품목</TableHead>
              <TableHead className="text-right w-[80px]">수량/개</TableHead>
              <TableHead className="text-right w-[80px]">수량/박스</TableHead>
              <TableHead>매입처</TableHead>
              <TableHead className="w-[90px]">KPIS신고</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  주문 항목이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  data-state={selectedOrderId === item.order_id && "selected"}
                  onClick={() => setSelectedOrderId(item.order_id)}
                >
                  <TableCell className="text-sm tabular-nums">
                    {formatMMDD(item.order_date)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatMMDD(item.delivery_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.hospital_name}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {item.product_name}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.box_quantity != null ? item.box_quantity.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.supplier_name ?? "-"}
                  </TableCell>
                  <TableCell>
                    {item.kpis_status ? (
                      <Badge
                        variant={KPIS_VARIANT[item.kpis_status] ?? "secondary"}
                        className="text-xs"
                      >
                        {KPIS_LABEL[item.kpis_status] ?? item.kpis_status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Sheet
        open={selectedOrderId !== null}
        onOpenChange={(open: boolean) => !open && setSelectedOrderId(null)}
      >
        <SheetContent className="w-[480px] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>주문 상세</SheetTitle>
          </SheetHeader>
          {selectedOrderId && <OrderDetail orderId={selectedOrderId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
