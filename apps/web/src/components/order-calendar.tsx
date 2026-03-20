"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { OrderDetail } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "초안", variant: "secondary" },
  confirmed: { label: "접수확인", variant: "default" },
  delivered: { label: "배송완료", variant: "outline" },
  invoiced: { label: "발행완료", variant: "default" },
  cancelled: { label: "취소", variant: "destructive" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function formatAmount(n: number | null) {
  if (n == null || n === 0) return "";
  return `₩${Math.round(n).toLocaleString()}`;
}

function getSalesReps(order: OrderDetail): string {
  const reps = [...new Set((order.items ?? []).map((i) => i.sales_rep).filter(Boolean))];
  return reps.join(", ");
}

// --- Renderers ---

function MonthItem({ order }: { order: OrderDetail }) {
  return (
    <span>
      <span className="font-medium">{order.order_number}</span>{" "}
      {order.hospital_name}
      {order.total_amount ? <span className="text-[10px] text-muted-foreground ml-1">{formatAmount(order.total_amount)}</span> : null}
    </span>
  );
}

function WeekItem({ order }: { order: OrderDetail }) {
  const st = STATUS_MAP[order.status];
  const reps = getSalesReps(order);
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium font-mono truncate">{order.order_number}</span>
        {st && <Badge variant={st.variant} className="text-[9px] px-1 py-0 h-3.5 shrink-0">{st.label}</Badge>}
      </div>
      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{order.hospital_name}</p>
      <div className="flex items-center justify-between gap-1 mt-0.5">
        {order.total_amount ? <span className="text-[10px] font-medium tabular-nums">{formatAmount(order.total_amount)}</span> : null}
        {reps && <span className="text-[9px] text-blue-600 truncate">{reps}</span>}
      </div>
    </div>
  );
}

function DayItem({ order }: { order: OrderDetail }) {
  const st = STATUS_MAP[order.status];
  const reps = getSalesReps(order);
  const items = order.items ?? [];
  const purchaseTotal = items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
  const salesTotal = items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0);
  const profit = salesTotal - purchaseTotal;
  const margin = salesTotal > 0 ? (profit / salesTotal) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium font-mono">{order.order_number}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {st && <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>}
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{order.hospital_name}</span>
        {reps && <span className="text-blue-600">담당: {reps}</span>}
        {order.delivery_date && <span>배송: {formatDate(order.delivery_date)}</span>}
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="border rounded text-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] py-1 h-auto">품목</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-12">수량</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">매입가</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">매출가</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">매출액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-[11px] py-0.5 truncate max-w-[120px]">{item.product_name || "-"}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.purchase_price?.toLocaleString() ?? "-"}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.unit_price?.toLocaleString() ?? "-"}</TableCell>
                  <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{((item.unit_price ?? 0) * item.quantity).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-3 text-xs">
        <span>매입 <strong className="tabular-nums">{formatAmount(purchaseTotal)}</strong></span>
        <span>매출 <strong className="tabular-nums">{formatAmount(salesTotal)}</strong></span>
        <span>이익 <strong className={`tabular-nums ${profit < 0 ? "text-red-500" : "text-green-600"}`}>{formatAmount(profit)}</strong></span>
        <span className={margin < 0 ? "text-red-500" : ""}>{margin.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function DetailContent({ order }: { order: OrderDetail }) {
  const st = STATUS_MAP[order.status];
  const items = order.items ?? [];
  const purchaseTotal = items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
  const salesTotal = items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0);
  const profit = salesTotal - purchaseTotal;
  const margin = salesTotal > 0 ? (profit / salesTotal) * 100 : 0;
  const reps = getSalesReps(order);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">주문번호</span>
          <p className="font-medium font-mono">{order.order_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground">거래처</span>
          <p className="font-medium">{order.hospital_name ?? "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">주문일</span>
          <p className="font-medium">{formatDate(order.order_date)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">배송일</span>
          <p className="font-medium">{order.delivery_date ? formatDate(order.delivery_date) : "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">상태</span>
          <p>{st && <Badge variant={st.variant}>{st.label}</Badge>}</p>
        </div>
        <div>
          <span className="text-muted-foreground">담당자</span>
          <p className="font-medium">{reps || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">매입총액</span>
          <p className="font-medium">{formatAmount(purchaseTotal) || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">매출총액</span>
          <p className="font-medium">{formatAmount(salesTotal) || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">매출이익</span>
          <p className={`font-bold ${profit < 0 ? "text-red-500" : "text-green-600"}`}>{formatAmount(profit)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">이익률</span>
          <p className={`font-bold ${margin < 0 ? "text-red-500" : ""}`}>{margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Items detail */}
      {items.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">품목 ({items.length}건)</h4>
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs py-1 h-auto">품목명</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-14">수량</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">매입단가</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">매출단가</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">매출액</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">이익</TableHead>
                  <TableHead className="text-xs py-1 h-auto w-16">담당자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const itemProfit = ((item.unit_price ?? 0) - (item.purchase_price ?? 0)) * item.quantity;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs py-1">{item.product_name || "-"}</TableCell>
                      <TableCell className="text-xs py-1 text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-xs py-1 text-right tabular-nums">{item.purchase_price?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-xs py-1 text-right tabular-nums">{item.unit_price?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-xs py-1 text-right tabular-nums">{((item.unit_price ?? 0) * item.quantity).toLocaleString()}</TableCell>
                      <TableCell className={`text-xs py-1 text-right tabular-nums ${itemProfit < 0 ? "text-red-500" : "text-green-600"}`}>{itemProfit.toLocaleString()}</TableCell>
                      <TableCell className="text-xs py-1">{item.sales_rep || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {order.notes && (
        <div>
          <h4 className="text-sm font-medium mb-1">메모</h4>
          <div className="rounded border p-3 text-sm bg-muted/30">{order.notes}</div>
        </div>
      )}

      <div className="pt-2">
        <a
          href={`/orders/${order.id}`}
          className="text-sm text-primary hover:underline"
        >
          상세 페이지로 이동 →
        </a>
      </div>
    </div>
  );
}

// --- Main component ---

interface OrderCalendarProps {
  initialView: CalendarView;
  initialDate: Date;
  orders: OrderDetail[];
}

export function OrderCalendar({ initialView, initialDate, orders }: OrderCalendarProps) {
  return (
    <DataCalendar
      items={orders}
      dateAccessor={(o) => new Date(o.order_date)}
      idAccessor={(o) => o.id}
      renderMonthItem={(o) => <MonthItem order={o} />}
      renderWeekItem={(o) => <WeekItem order={o} />}
      renderDayItem={(o) => <DayItem order={o} />}
      renderDetail={(o) => <DetailContent order={o} />}
      detailTitle={(o) => `주문 ${o.order_number}`}
      initialView={initialView}
      initialDate={initialDate}
      basePath="/orders"
      tabParam="calendar"
    />
  );
}
