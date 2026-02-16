"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft, ChevronRight, Calendar, CalendarDays, CalendarClock,
  MessageSquare, ClipboardList, Banknote, Trash2, Loader2,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  getDay, format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  eachDayOfInterval, isToday, isSameMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { OrderDetail } from "@/components/order-detail";
import { deleteOrder, deleteMessage, updateOrder } from "@/lib/actions";
import { updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";
import type { CalendarDay, Order, RawMessage } from "@/lib/types";

type ViewMode = "month" | "week" | "day";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_LABEL: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "default",
  processing: "default",
  delivered: "outline",
  cancelled: "destructive",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const SOURCE_LABEL: Record<string, string> = {
  kakaotalk: "카카오톡",
  sms: "SMS",
  telegram: "텔레그램",
  manual: "수동",
};

const PARSE_STATUS_LABEL: Record<string, string> = {
  parsed: "파싱완료",
  pending: "대기",
  failed: "실패",
  skipped: "건너뜀",
};

function formatAmount(n: number | null) {
  if (n == null || n === 0) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function formatTime(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, max = 50) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

interface OrderCalendarProps {
  month: string;
  days: CalendarDay[];
  orders: Order[];
  messages: RawMessage[];
}

export function OrderCalendar({ month, days, orders, messages }: OrderCalendarProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [dayAnchor, setDayAnchor] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

  // CRUD state
  const [sheetOrderId, setSheetOrderId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "order" | "message"; id: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentMonth = new Date(month + "-01");

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  function navigateMonth(offset: number) {
    const target = offset > 0 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1);
    router.push(`/calendar?month=${format(target, "yyyy-MM")}`);
  }

  function navigateWeek(offset: number) {
    const anchor = new Date(weekAnchor);
    const target = offset > 0 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
    const targetMonth = format(target, "yyyy-MM");
    setWeekAnchor(format(target, "yyyy-MM-dd"));
    if (targetMonth !== month) {
      router.push(`/calendar?month=${targetMonth}`);
    }
  }

  function navigateDay(offset: number) {
    const anchor = new Date(dayAnchor);
    const target = offset > 0 ? addDays(anchor, 1) : subDays(anchor, 1);
    const targetMonth = format(target, "yyyy-MM");
    setDayAnchor(format(target, "yyyy-MM-dd"));
    if (targetMonth !== month) {
      router.push(`/calendar?month=${targetMonth}`);
    }
  }

  function selectDay(dateStr: string) {
    if (viewMode === "month") {
      setSelectedDate(prev => prev === dateStr ? null : dateStr);
    } else {
      setDayAnchor(dateStr);
      setViewMode("day");
    }
  }

  function handleStatusChange(orderId: number, newStatus: string) {
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderId, newStatus);
        toast.success(`상태가 "${STATUS_LABEL[newStatus]}"(으)로 변경되었습니다.`);
        router.refresh();
      } catch {
        toast.error("상태 변경에 실패했습니다.");
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        if (deleteTarget.type === "order") {
          await deleteOrder(deleteTarget.id);
          toast.success("주문이 삭제되었습니다.");
        } else {
          await deleteMessage(deleteTarget.id);
          toast.success("메시지가 삭제되었습니다.");
        }
        setDeleteTarget(null);
        setSheetOrderId(null);
        router.refresh();
      } catch {
        toast.error("삭제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="h-full flex flex-col">
      {/* View mode toggle + navigation */}
      <div className="flex items-center justify-between shrink-0 pb-3">
        <div className="flex gap-1">
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            <Calendar className="h-4 w-4 mr-1" />
            월
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => { setViewMode("week"); setWeekAnchor(format(new Date(), "yyyy-MM-dd")); }}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            주
          </Button>
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => { setViewMode("day"); setDayAnchor(format(new Date(), "yyyy-MM-dd")); }}
          >
            <CalendarClock className="h-4 w-4 mr-1" />
            일
          </Button>
        </div>

        {viewMode === "month" && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[120px] text-center">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </h2>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {viewMode === "week" && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <WeekLabel anchor={weekAnchor} />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {viewMode === "day" && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">
              {format(new Date(dayAnchor), "yyyy년 M월 d일 (EEE)", { locale: ko })}
            </h2>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const today = format(new Date(), "yyyy-MM-dd");
            const todayMonth = format(new Date(), "yyyy-MM");
            setWeekAnchor(today);
            setDayAnchor(today);
            setSelectedDate(null);
            if (todayMonth !== month) {
              router.push(`/calendar?month=${todayMonth}`);
            }
          }}
        >
          오늘
        </Button>
      </div>

      {/* Views — flex-1 to fill remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "month" && (
          <MonthView
            month={month}
            days={days}
            dayMap={dayMap}
            orders={orders}
            selectedDate={selectedDate}
            onSelectDay={selectDay}
            onOpenOrder={setSheetOrderId}
          />
        )}
        {viewMode === "week" && (
          <WeekView
            weekAnchor={weekAnchor}
            month={month}
            dayMap={dayMap}
            orders={orders}
            messages={messages}
            onSelectDay={selectDay}
            onOpenOrder={setSheetOrderId}
            onStatusChange={handleStatusChange}
          />
        )}
        {viewMode === "day" && (
          <DayView
            dayAnchor={dayAnchor}
            dayMap={dayMap}
            orders={orders}
            messages={messages}
            onOpenOrder={setSheetOrderId}
            onStatusChange={handleStatusChange}
            onDeleteMessage={(id) => setDeleteTarget({ type: "message", id })}
          />
        )}
      </div>

      {/* Order Detail Sheet */}
      <Sheet open={sheetOrderId !== null} onOpenChange={(open) => { if (!open) setSheetOrderId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>주문 상세</SheetTitle>
          </SheetHeader>
          {sheetOrderId !== null && (
            <div className="space-y-4">
              <OrderDetail orderId={sheetOrderId} />
              {/* Delete button — only for draft orders */}
              {orders.find(o => o.id === sheetOrderId)?.status === "draft" && (
                <div className="pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setDeleteTarget({ type: "order", id: sheetOrderId })}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    주문 삭제
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>삭제 확인</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "order"
                ? "이 주문을 삭제하시겠습니까? 관련된 주문 품목도 함께 삭제됩니다."
                : "이 메시지를 삭제하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Week Label ─── */
function WeekLabel({ anchor }: { anchor: string }) {
  const anchorDate = new Date(anchor);
  const ws = startOfWeek(anchorDate, { weekStartsOn: 0 });
  const we = endOfWeek(anchorDate, { weekStartsOn: 0 });
  return (
    <h2 className="text-lg font-semibold min-w-[200px] text-center">
      {format(ws, "M/d", { locale: ko })} ~ {format(we, "M/d (yyyy)", { locale: ko })}
    </h2>
  );
}

/* ─── Status Badge with Dropdown ─── */
function StatusBadge({
  order,
  interactive,
  onStatusChange,
}: {
  order: Order;
  interactive?: boolean;
  onStatusChange?: (orderId: number, status: string) => void;
}) {
  const transitions = STATUS_TRANSITIONS[order.status] || [];

  if (!interactive || transitions.length === 0 || !onStatusChange) {
    return (
      <Badge variant={STATUS_VARIANT[order.status] || "outline"}>
        {STATUS_LABEL[order.status] || order.status}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="cursor-pointer">
          <Badge variant={STATUS_VARIANT[order.status] || "outline"} className="cursor-pointer hover:opacity-80">
            {STATUS_LABEL[order.status] || order.status} ▾
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {transitions.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onStatusChange(order.id, s)}>
            <Badge variant={STATUS_VARIANT[s] || "outline"} className="mr-2">
              {STATUS_LABEL[s]}
            </Badge>
            (으)로 변경
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ═══════════════════════════════════════════════
   MONTH VIEW
   ═══════════════════════════════════════════════ */
function MonthView({
  month, days, dayMap, orders, selectedDate, onSelectDay, onOpenOrder,
}: {
  month: string;
  days: CalendarDay[];
  dayMap: Map<string, CalendarDay>;
  orders: Order[];
  selectedDate: string | null;
  onSelectDay: (d: string) => void;
  onOpenOrder: (id: number) => void;
}) {
  const currentMonth = new Date(month + "-01");
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDayOfWeek = getDay(monthStart);

  const allDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [month],
  );

  const selectedOrders = useMemo(() => {
    if (!selectedDate) return [];
    return orders.filter((o) => o.order_date === selectedDate);
  }, [orders, selectedDate]);

  return (
    <div className="h-full flex flex-col">
      {/* Calendar grid */}
      <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b shrink-0">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`py-2 text-center text-xs font-medium ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 overflow-y-auto">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r bg-muted/20" />
          ))}
          {allDays.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const dayData = dayMap.get(dateStr);
            const today = isToday(date);
            const isSelected = selectedDate === dateStr;
            const dayOfWeek = getDay(date);
            const hasOrders = dayData && dayData.order_count > 0;

            return (
              <div
                key={dateStr}
                className={`min-h-[80px] border-b border-r p-1.5 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/10 ring-2 ring-primary ring-inset"
                    : hasOrders
                      ? "bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30"
                      : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectDay(dateStr)}
              >
                <span
                  className={`text-sm font-medium ${
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                      : dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
                  }`}
                >
                  {format(date, "d")}
                </span>
                {dayData && (
                  <div className="mt-1 space-y-0.5">
                    {dayData.order_count > 0 && (
                      <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                        주문 {dayData.order_count}
                      </Badge>
                    )}
                    {dayData.message_count > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        메시지 {dayData.message_count}
                      </div>
                    )}
                    {dayData.total_amount > 0 && (
                      <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        {formatAmount(dayData.total_amount)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="space-y-3 shrink-0 max-h-[250px] overflow-y-auto pt-3">
          <h3 className="text-lg font-semibold">
            {format(new Date(selectedDate), "M월 d일 (EEEE)", { locale: ko })} 주문 내역
          </h3>
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">해당 날짜에 주문이 없습니다.</p>
          ) : (
            <OrdersTable orders={selectedOrders} onOpenOrder={onOpenOrder} />
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   WEEK VIEW
   ═══════════════════════════════════════════════ */
function WeekView({
  weekAnchor, month, dayMap, orders, messages, onSelectDay, onOpenOrder, onStatusChange,
}: {
  weekAnchor: string;
  month: string;
  dayMap: Map<string, CalendarDay>;
  orders: Order[];
  messages: RawMessage[];
  onSelectDay: (d: string) => void;
  onOpenOrder: (id: number) => void;
  onStatusChange: (orderId: number, status: string) => void;
}) {
  const anchorDate = new Date(weekAnchor);
  const ws = startOfWeek(anchorDate, { weekStartsOn: 0 });
  const we = endOfWeek(anchorDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: ws, end: we });

  const weekData = useMemo(() => {
    return weekDays.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const calDay = dayMap.get(dateStr);
      const dayOrders = orders.filter((o) => o.order_date === dateStr);
      const dayMessages = messages.filter((m) => m.received_at.slice(0, 10) === dateStr);
      return { date, dateStr, calDay, dayOrders, dayMessages };
    });
  }, [weekDays, dayMap, orders, messages]);

  const weekTotals = useMemo(() => {
    return weekData.reduce(
      (acc, d) => ({
        messages: acc.messages + d.dayMessages.length,
        orders: acc.orders + d.dayOrders.length,
        amount: acc.amount + (d.calDay?.total_amount || 0),
      }),
      { messages: 0, orders: 0, amount: 0 },
    );
  }, [weekData]);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Week summary */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">주간 메시지</div>
              <div className="text-lg font-semibold">{weekTotals.messages}건</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">주간 주문</div>
              <div className="text-lg font-semibold">{weekTotals.orders}건</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">주간 금액</div>
              <div className="text-lg font-semibold">{formatAmount(weekTotals.amount)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-day columns — each column scrolls independently */}
      <div className="grid grid-cols-7 gap-2 flex-1 min-h-0">
        {weekData.map(({ date, dateStr, calDay, dayOrders, dayMessages }) => {
          const today = isToday(date);
          const dayOfWeek = getDay(date);
          const inMonth = isSameMonth(date, new Date(month + "-01"));

          return (
            <div
              key={dateStr}
              className={`rounded-md border flex flex-col overflow-hidden ${
                today
                  ? "ring-2 ring-primary"
                  : !inMonth
                    ? "bg-muted/30 opacity-60"
                    : dayOrders.length > 0
                      ? "bg-blue-50 dark:bg-blue-950/20"
                      : ""
              }`}
            >
              {/* Day header — fixed */}
              <div
                className="text-center p-2 border-b cursor-pointer hover:bg-muted/50 shrink-0"
                onClick={() => onSelectDay(dateStr)}
              >
                <div className={`text-xs ${
                  dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-muted-foreground"
                }`}>
                  {WEEKDAYS[dayOfWeek]}
                </div>
                <div className={`text-lg font-semibold ${
                  today ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                    : dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""
                }`}>
                  {format(date, "d")}
                </div>
                {calDay && calDay.total_amount > 0 && (
                  <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                    {formatAmount(calDay.total_amount)}
                  </div>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                {dayOrders.length === 0 && dayMessages.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center mt-4">활동 없음</p>
                ) : (
                  <>
                    {dayOrders.map((order) => (
                      <div
                        key={order.id}
                        className="text-[10px] bg-background/80 rounded border px-1.5 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onOpenOrder(order.id); }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-medium truncate">{order.order_number.slice(-4)}</span>
                          <StatusBadge order={order} interactive onStatusChange={onStatusChange} />
                        </div>
                        <div className="text-muted-foreground truncate">{order.hospital_name || "-"}</div>
                      </div>
                    ))}
                    {dayMessages.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 w-full justify-center">
                        메시지 {dayMessages.length}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DAY VIEW
   ═══════════════════════════════════════════════ */
function DayView({
  dayAnchor, dayMap, orders, messages, onOpenOrder, onStatusChange, onDeleteMessage,
}: {
  dayAnchor: string;
  dayMap: Map<string, CalendarDay>;
  orders: Order[];
  messages: RawMessage[];
  onOpenOrder: (id: number) => void;
  onStatusChange: (orderId: number, status: string) => void;
  onDeleteMessage: (id: number) => void;
}) {
  const calDay = dayMap.get(dayAnchor);
  const dayOrders = useMemo(
    () => orders.filter((o) => o.order_date === dayAnchor),
    [orders, dayAnchor],
  );
  const dayMessages = useMemo(
    () => messages.filter((m) => m.received_at.slice(0, 10) === dayAnchor),
    [messages, dayAnchor],
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Day summary cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">수신 메시지</div>
              <div className="text-2xl font-bold">{dayMessages.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
              <ClipboardList className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">주문</div>
              <div className="text-2xl font-bold">{dayOrders.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900">
              <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">주문 금액</div>
              <div className="text-2xl font-bold">{formatAmount(calDay?.total_amount ?? 0)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
        {/* Messages section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            수신 메시지
          </h3>
          {dayMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
              해당 날짜에 수신된 메시지가 없습니다.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">시간</TableHead>
                    <TableHead>발신자</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead>출처</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>주문</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayMessages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {formatTime(msg.received_at)}
                      </TableCell>
                      <TableCell className="font-medium">{msg.sender || "-"}</TableCell>
                      <TableCell className="max-w-[300px] text-sm text-muted-foreground">
                        {truncate(msg.content)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABEL[msg.source_app] || msg.source_app}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={msg.parse_status === "parsed" ? "default" : "secondary"} className="text-xs">
                          {PARSE_STATUS_LABEL[msg.parse_status] || msg.parse_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {msg.order_id ? `#${msg.order_id}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteMessage(msg.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Orders section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            주문 내역
          </h3>
          {dayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
              해당 날짜에 주문이 없습니다.
            </p>
          ) : (
            <OrdersTable orders={dayOrders} onOpenOrder={onOpenOrder} interactive onStatusChange={onStatusChange} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Orders Table ─── */
function OrdersTable({
  orders,
  onOpenOrder,
  interactive,
  onStatusChange,
}: {
  orders: Order[];
  onOpenOrder?: (id: number) => void;
  interactive?: boolean;
  onStatusChange?: (orderId: number, status: string) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>주문번호</TableHead>
            <TableHead>거래처</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>품목수</TableHead>
            <TableHead className="text-right">금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className={onOpenOrder ? "cursor-pointer hover:bg-muted/50" : ""}
              onClick={() => onOpenOrder?.(order.id)}
            >
              <TableCell className="font-medium">{order.order_number}</TableCell>
              <TableCell>{order.hospital_name || "-"}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <StatusBadge order={order} interactive={interactive} onStatusChange={onStatusChange} />
              </TableCell>
              <TableCell>{order.total_items}</TableCell>
              <TableCell className="text-right">{formatAmount(order.total_amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
