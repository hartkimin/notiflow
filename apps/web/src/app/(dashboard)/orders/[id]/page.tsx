import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { getOrder } from "@/lib/queries/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RealtimeListener } from "@/components/realtime-listener";
import { OrderStatusActions } from "@/components/order-status-actions";
import { PrintButton } from "@/components/print-button";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const orderId = Number(id);
  if (isNaN(orderId)) notFound();

  let order;
  try {
    order = await getOrder(orderId);
  } catch {
    notFound();
  }

  const supplyTotal = order.items.reduce(
    (sum, item) => sum + (item.line_total ?? (item.quantity * (item.unit_price ?? 0))),
    0,
  );
  const taxTotal = Math.round(supplyTotal * 0.1);

  return (
    <>
      <RealtimeListener tables={["orders", "order_items"]} />

      {/* Header - hidden on print */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" className="shrink-0" asChild>
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold md:text-2xl truncate">
              주문 상세 - {order.order_number}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {order.order_date} | {order.hospital_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <PrintButton />
          <OrderStatusActions orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      {/* Print header - visible only on print */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold text-center mb-2">주문서</h1>
        <div className="flex justify-between text-sm">
          <div>
            <p><strong>주문번호:</strong> {order.order_number}</p>
            <p><strong>주문일:</strong> {order.order_date}</p>
            <p><strong>거래처:</strong> {order.hospital_name}</p>
          </div>
          <div className="text-right">
            <p><strong>상태:</strong> {STATUS_LABELS[order.status]}</p>
            {order.delivery_date && (
              <p><strong>배송예정:</strong> {order.delivery_date}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order info cards */}
      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-2">
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={order.status === "draft" ? "secondary" : "default"}>
              {STATUS_LABELS[order.status] || order.status}
            </Badge>
          </CardContent>
        </Card>
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              배송예정일
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {order.delivery_date || "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              합계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {(supplyTotal + taxTotal).toLocaleString("ko-KR")}원
            </p>
            <p className="text-xs text-muted-foreground">
              공급가 {supplyTotal.toLocaleString("ko-KR")}원 + 세액 {taxTotal.toLocaleString("ko-KR")}원
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Original message */}
      {order.message_content && (
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              원문 메시지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                {order.message_sender && (
                  <span className="font-medium text-foreground">{order.message_sender}</span>
                )}
                {order.message_received_at && (
                  <span>
                    {new Date(order.message_received_at).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <pre className="text-sm whitespace-pre-wrap font-sans">{order.message_content}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order items table */}
      <Card className="print:border print:shadow-none">
        <CardHeader>
          <CardTitle>주문 항목 ({order.items.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>품목</TableHead>
                <TableHead className="hidden sm:table-cell print:table-cell">원문</TableHead>
                <TableHead className="text-right whitespace-nowrap">수량</TableHead>
                <TableHead className="text-right whitespace-nowrap">단가</TableHead>
                <TableHead className="text-right whitespace-nowrap">금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, idx) => {
                const itemAny = item as unknown as Record<string, unknown>;
                const productName = itemAny.products
                  ? (itemAny.products as { name: string }).name
                  : `제품 #${item.product_id ?? "미매칭"}`;
                const lineTotal = item.line_total ?? item.quantity * (item.unit_price ?? 0);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{productName}</div>
                      {item.match_status !== "matched" && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {item.match_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell print:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                      {item.original_text || "-"}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {(item.unit_price ?? 0).toLocaleString("ko-KR")}원
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {lineTotal.toLocaleString("ko-KR")}원
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals */}
              <TableRow className="font-semibold">
                <TableCell colSpan={5} className="text-right">
                  공급가액
                </TableCell>
                <TableCell className="text-right">
                  {supplyTotal.toLocaleString("ko-KR")}원
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5} className="text-right text-muted-foreground">
                  세액 (10%)
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {taxTotal.toLocaleString("ko-KR")}원
                </TableCell>
              </TableRow>
              <TableRow className="font-bold text-lg">
                <TableCell colSpan={5} className="text-right">
                  합계
                </TableCell>
                <TableCell className="text-right">
                  {(supplyTotal + taxTotal).toLocaleString("ko-KR")}원
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card className="print:border print:shadow-none">
          <CardHeader>
            <CardTitle>비고</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
