"use client";

import { Badge } from "@/components/ui/badge";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { Order } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "임시", variant: "secondary" },
  confirmed: { label: "확인됨", variant: "default" },
  processing: { label: "처리중", variant: "default" },
  delivered: { label: "배송완료", variant: "outline" },
  cancelled: { label: "취소", variant: "destructive" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// --- Renderers ---

function MonthItem({ order }: { order: Order }) {
  return (
    <span>
      <span className="font-medium">{order.order_number}</span>{" "}
      {order.hospital_name}
    </span>
  );
}

function WeekItem({ order }: { order: Order }) {
  const st = STATUS_MAP[order.status];
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium font-mono truncate">{order.order_number}</span>
        {st && <Badge variant={st.variant} className="text-[9px] px-1 py-0 h-3.5 shrink-0">{st.label}</Badge>}
      </div>
      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{order.hospital_name}</p>
    </div>
  );
}

function DayItem({ order }: { order: Order }) {
  const st = STATUS_MAP[order.status];
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium font-mono">{order.order_number}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {st && <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>}
          <span className="text-xs text-muted-foreground">{formatDate(order.order_date)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{order.hospital_name}</p>
      {order.delivery_date && (
        <span className="text-xs text-muted-foreground">배송: {formatDate(order.delivery_date)}</span>
      )}
    </div>
  );
}

function DetailContent({ order }: { order: Order }) {
  const st = STATUS_MAP[order.status];
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
          <span className="text-muted-foreground">품목수</span>
          <p className="font-medium">{order.total_items}건</p>
        </div>
      </div>

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
  orders: Order[];
  initialView: CalendarView;
  initialDate: Date;
}

export function OrderCalendar({ orders, initialView, initialDate }: OrderCalendarProps) {
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
