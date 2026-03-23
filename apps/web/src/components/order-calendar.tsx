"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { OrderDetail } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; color: string; bgClass: string }> = {
  draft: { label: "초안", color: "bg-gray-400", bgClass: "text-gray-700 bg-gray-100 border-gray-300" },
  confirmed: { label: "접수확인", color: "bg-blue-500", bgClass: "text-blue-700 bg-blue-50 border-blue-300" },
  delivered: { label: "배송완료", color: "bg-green-500", bgClass: "text-green-700 bg-green-50 border-green-300" },
  invoiced: { label: "발행완료", color: "bg-emerald-600", bgClass: "text-emerald-700 bg-emerald-50 border-emerald-300" },
  cancelled: { label: "취소", color: "bg-red-500", bgClass: "text-red-700 bg-red-50 border-red-300" },
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
  const st = STATUS_MAP[order.status];
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${st?.color ?? "bg-gray-400"} shrink-0`} />
      <span className="font-medium truncate">{order.hospital_name ?? order.order_number}</span>
      {order.total_amount ? <span className="text-muted-foreground ml-auto shrink-0">{formatAmount(order.total_amount)}</span> : null}
    </span>
  );
}

function WeekItem({ order }: { order: OrderDetail }) {
  const st = STATUS_MAP[order.status];
  const borderColor = order.status === "delivered" ? "border-l-green-500" :
                      order.status === "confirmed" ? "border-l-blue-500" :
                      order.status === "invoiced" ? "border-l-emerald-600" :
                      order.status === "cancelled" ? "border-l-red-500" : "border-l-gray-400";
  return (
    <div className={`border-l-2 ${borderColor} pl-1.5`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium truncate">{order.hospital_name}</span>
        {st && (
          <span className={`text-[9px] px-1 py-0 rounded border shrink-0 ${st.bgClass}`}>
            {st.label}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 mt-0.5">
        <span className="text-[10px] text-muted-foreground font-mono">{order.order_number}</span>
        {order.total_amount ? <span className="text-[10px] font-semibold tabular-nums">{formatAmount(order.total_amount)}</span> : null}
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
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{order.hospital_name}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">{order.order_number}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {st && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${st.bgClass}`}>
              {st.label}
            </span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {reps && <span className="text-blue-600">담당: {reps}</span>}
        {order.delivery_date && <span>배송: {formatDate(order.delivery_date)}</span>}
        <span className="ml-auto font-semibold text-foreground tabular-nums">
          매출 {formatAmount(salesTotal)}
          {profit !== 0 && (
            <span className={`ml-2 ${profit < 0 ? "text-red-500" : "text-green-600"}`}>
              이익 {formatAmount(profit)} ({margin.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="border rounded text-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[10px] py-1 h-auto">품목명</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-12">수량</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">매입가</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">매출가</TableHead>
                <TableHead className="text-[10px] py-1 h-auto text-right w-16">이익</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const itemProfit = ((item.unit_price ?? 0) - (item.purchase_price ?? 0)) * item.quantity;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-[11px] py-0.5 truncate max-w-[140px]">{item.product_name || "-"}</TableCell>
                    <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.purchase_price?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell className="text-[11px] py-0.5 text-right tabular-nums">{item.unit_price?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell className={`text-[11px] py-0.5 text-right tabular-nums ${itemProfit < 0 ? "text-red-500" : "text-green-600"}`}>{itemProfit.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
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
          <p>{st && <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${st.bgClass}`}>{st.label}</span>}</p>
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
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-1 h-auto">품목명</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-14">수량</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">매입가</TableHead>
                  <TableHead className="text-xs py-1 h-auto text-right w-20">매출가</TableHead>
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
