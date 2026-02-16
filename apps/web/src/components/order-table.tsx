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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderDetail } from "@/components/order-detail";
import { MoreHorizontal } from "lucide-react";
import type { Order } from "@/lib/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "default",
  processing: "default",
  delivered: "outline",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

function formatAmount(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

export function OrderTable({ orders }: { orders: Order[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox />
              </TableHead>
              <TableHead>주문번호</TableHead>
              <TableHead>주문일</TableHead>
              <TableHead className="hidden md:table-cell">거래처</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead className="hidden sm:table-cell">상태</TableHead>
              <TableHead className="w-[100px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  주문이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} data-state={selectedId === order.id && "selected"}>
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                  <TableCell
                    className="font-medium cursor-pointer"
                    onClick={() => setSelectedId(order.id)}
                  >
                    {order.order_number}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => setSelectedId(order.id)}
                  >
                    {order.order_date}
                  </TableCell>
                  <TableCell
                    className="hidden md:table-cell cursor-pointer"
                    onClick={() => setSelectedId(order.id)}
                  >
                    {order.hospital_name}
                  </TableCell>
                  <TableCell
                    className="text-right cursor-pointer"
                    onClick={() => setSelectedId(order.id)}
                  >
                    {formatAmount(order.total_amount)}
                  </TableCell>
                  <TableCell
                    className="hidden sm:table-cell cursor-pointer"
                    onClick={() => setSelectedId(order.id)}
                  >
                    <Badge variant={STATUS_VARIANT[order.status] || "secondary"}>
                      {STATUS_LABEL[order.status] || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setSelectedId(order.id)}>상세보기</DropdownMenuItem>
                        <DropdownMenuItem>상태 변경</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">삭제</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Sheet open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-[480px] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>주문 상세</SheetTitle>
          </SheetHeader>
          {selectedId && <OrderDetail orderId={selectedId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
