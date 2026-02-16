"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirmOrderAction, updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";
import { toast } from "sonner";
import type { OrderDetail as OrderDetailType } from "@/lib/types";

async function fetchOrderDetail(url: string): Promise<OrderDetailType> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export function OrderDetail({ orderId }: { orderId: number }) {
  const { data: order, error, isLoading } = useSWR(
    `/api/orders/${orderId}`,
    fetchOrderDetail
  );

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">로딩 중...</p>;
  if (error || !order) return <p className="p-4 text-sm text-destructive">주문 정보를 불러올 수 없습니다.</p>;

  async function handleConfirm() {
    try {
      await confirmOrderAction(orderId);
      toast.success("주문이 확인되었습니다.");
    } catch {
      toast.error("주문 확인에 실패했습니다.");
    }
  }

  async function handleCancel() {
    try {
      await updateOrderStatusAction(orderId, "cancelled");
      toast.success("주문이 취소되었습니다.");
    } catch {
      toast.error("주문 취소에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">주문번호</span>
          <p className="font-medium">{order.order_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground">주문일</span>
          <p>{order.order_date}</p>
        </div>
        <div>
          <span className="text-muted-foreground">상태</span>
          <p><Badge>{order.status}</Badge></p>
        </div>
        <div>
          <span className="text-muted-foreground">배송예정</span>
          <p>{order.delivery_date || "-"}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="mb-2 text-sm font-medium">주문 품목 ({order.items.length}건)</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>원본텍스트</TableHead>
              <TableHead>수량</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="text-right">합계</TableHead>
              <TableHead>매칭</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs">{item.original_text || "-"}</TableCell>
                <TableCell>{item.quantity} {item.unit_type}</TableCell>
                <TableCell className="text-right">
                  {item.unit_price?.toLocaleString("ko-KR") || "-"}
                </TableCell>
                <TableCell className="text-right">
                  {item.line_total?.toLocaleString("ko-KR") || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.match_status === "matched" ? "default" : "destructive"} className="text-xs">
                    {item.match_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex gap-2">
        {order.status === "draft" && (
          <Button size="sm" onClick={handleConfirm}>주문 확인</Button>
        )}
        {order.status === "draft" && (
          <Button size="sm" variant="destructive" onClick={handleCancel}>취소</Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={`/api/v1/orders/${orderId}/pdf`} target="_blank" rel="noreferrer">PDF</a>
        </Button>
      </div>
    </div>
  );
}
