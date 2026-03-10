"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ClipboardList, Trash2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataCalendar } from "@/components/data-calendar";
import {
  deleteForecast,
  getForecastDetail,
  unmatchForecast,
} from "@/app/(dashboard)/notifications/forecast-actions";
import type { CalendarView } from "@/lib/schedule-utils";
import type {
  CapturedMessage,
  ForecastItem,
  ForecastStatus,
  Hospital,
  MessageCalendarItem,
  OrderForecast,
  // Product type not needed; only Hospital for calendar props
} from "@/lib/types";

// ─── Constants ───────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  kakaotalk: "카카오톡",
  sms: "SMS",
  telegram: "텔레그램",
};

const FORECAST_STATUS_LABEL: Record<ForecastStatus, string> = {
  pending: "대기",
  matched: "매칭됨",
  partial: "부분매칭",
  missed: "미수신",
  cancelled: "취소",
};

const FORECAST_STATUS_CLASSES: Record<ForecastStatus, string> = {
  pending: "text-orange-600 bg-orange-50 border-orange-200",
  matched: "text-green-600 bg-green-50 border-green-200",
  partial: "text-blue-600 bg-blue-50 border-blue-200",
  missed: "text-red-600 bg-red-50 border-red-200",
  cancelled: "text-muted-foreground bg-muted",
};

// ─── Helpers ─────────────────────────────────────

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(epochMs)}`;
}

function formatForecastDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function ForecastStatusBadge({ status }: { status: ForecastStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${FORECAST_STATUS_CLASSES[status]}`}>
      {FORECAST_STATUS_LABEL[status]}
    </span>
  );
}

// ─── Message Renderers ───────────────────────────

function MessageMonthItem({ msg }: { msg: CapturedMessage }) {
  return (
    <span>
      <span className="font-medium">{msg.sender ?? "?"}</span>{" "}
      {msg.content?.slice(0, 20)}
    </span>
  );
}

function MessageWeekItem({ msg }: { msg: CapturedMessage }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium truncate">{msg.sender ?? "?"}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(msg.received_at)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{msg.content}</p>
    </div>
  );
}

function MessageDayItem({ msg }: { msg: CapturedMessage }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{msg.sender ?? "?"}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px]">
            {SOURCE_LABELS[msg.source] ?? msg.app_name}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(msg.received_at)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{msg.content}</p>
    </div>
  );
}

// ─── Forecast Renderers ──────────────────────────

function ForecastMonthItem({ forecast }: { forecast: OrderForecast }) {
  return (
    <span className="flex items-center gap-1">
      <ClipboardList className={`h-3 w-3 shrink-0 ${FORECAST_STATUS_CLASSES[forecast.status].split(" ")[0]}`} />
      <span className="font-medium truncate">{forecast.hospital_name ?? `병원#${forecast.hospital_id}`}</span>
    </span>
  );
}

function ForecastWeekItem({ forecast }: { forecast: OrderForecast }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[11px] font-medium truncate">
          <ClipboardList className="h-3 w-3 shrink-0" />
          {forecast.hospital_name ?? `병원#${forecast.hospital_id}`}
        </span>
        <ForecastStatusBadge status={forecast.status} />
      </div>
    </div>
  );
}

function ForecastDayItem({ forecast }: { forecast: OrderForecast }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium truncate">
          <ClipboardList className="h-4 w-4 shrink-0" />
          {forecast.hospital_name ?? `병원#${forecast.hospital_id}`}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <ForecastStatusBadge status={forecast.status} />
          <span className="text-xs text-muted-foreground">{formatForecastDate(forecast.forecast_date)}</span>
        </div>
      </div>
      {forecast.notes && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{forecast.notes}</p>
      )}
    </div>
  );
}

// ─── Dispatching Renderers ───────────────────────

function MonthItem({ item }: { item: MessageCalendarItem }) {
  if (item.kind === "forecast") return <ForecastMonthItem forecast={item.data} />;
  return <MessageMonthItem msg={item.data} />;
}

function WeekItem({ item }: { item: MessageCalendarItem }) {
  if (item.kind === "forecast") return <ForecastWeekItem forecast={item.data} />;
  return <MessageWeekItem msg={item.data} />;
}

function DayItem({ item }: { item: MessageCalendarItem }) {
  if (item.kind === "forecast") return <ForecastDayItem forecast={item.data} />;
  return <MessageDayItem msg={item.data} />;
}

// ─── Message Detail ──────────────────────────────

function MessageDetailContent({ msg }: { msg: CapturedMessage }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">발신자</span>
          <p className="font-medium">{msg.sender ?? "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">수신시간</span>
          <p className="font-medium">{formatDate(msg.received_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">출처</span>
          <p><Badge variant="outline">{SOURCE_LABELS[msg.source] ?? msg.app_name}</Badge></p>
        </div>
        {msg.room_name && (
          <div>
            <span className="text-muted-foreground">대화방</span>
            <p className="font-medium">{msg.room_name}</p>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-1">메시지 내용</h4>
        <div className="rounded border p-3 text-sm whitespace-pre-wrap bg-muted/30">
          {msg.content}
        </div>
      </div>
    </div>
  );
}

// ─── Forecast Detail ─────────────────────────────

function ForecastDetailContent({ forecast }: { forecast: OrderForecast }) {
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    getForecastDetail(forecast.id)
      .then((detail) => setItems(detail?.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [forecast.id]);

  function handleDelete() {
    startTransition(async () => {
      await deleteForecast(forecast.id);
    });
  }

  function handleUnmatch() {
    startTransition(async () => {
      await unmatchForecast(forecast.id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">병원</span>
          <p className="font-medium">{forecast.hospital_name ?? `병원#${forecast.hospital_id}`}</p>
        </div>
        <div>
          <span className="text-muted-foreground">예보일</span>
          <p className="font-medium">{forecast.forecast_date}</p>
        </div>
        <div>
          <span className="text-muted-foreground">상태</span>
          <p><ForecastStatusBadge status={forecast.status} /></p>
        </div>
        <div>
          <span className="text-muted-foreground">출처</span>
          <p className="font-medium">{forecast.source === "manual" ? "수동" : "패턴"}</p>
        </div>
        {forecast.matched_at && (
          <div>
            <span className="text-muted-foreground">매칭시간</span>
            <p className="font-medium">{new Date(forecast.matched_at).toLocaleString("ko-KR")}</p>
          </div>
        )}
      </div>

      {forecast.notes && (
        <div>
          <h4 className="text-sm font-medium mb-1">메모</h4>
          <div className="rounded border p-3 text-sm whitespace-pre-wrap bg-muted/30">
            {forecast.notes}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium mb-1">예보 품목</h4>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 품목이 없습니다.</p>
        ) : (
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">품목</th>
                  <th className="text-right px-2 py-1 font-medium">수량</th>
                  <th className="text-left px-2 py-1 font-medium">단위</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-2 py-1">{item.item_name ?? "-"}</td>
                    <td className="px-2 py-1 text-right">{item.quantity ?? "-"}</td>
                    <td className="px-2 py-1">{item.unit_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t">
        {forecast.matched_at && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={isPending}
            onClick={handleUnmatch}
          >
            <Unlink className="h-3.5 w-3.5 mr-1" />
            매칭 해제
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          disabled={isPending}
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          삭제
        </Button>
      </div>
    </div>
  );
}

// ─── Detail Dispatcher ───────────────────────────

function DetailContent({ item }: { item: MessageCalendarItem }) {
  if (item.kind === "forecast") return <ForecastDetailContent forecast={item.data} />;
  return <MessageDetailContent msg={item.data} />;
}

// ─── Accessors ───────────────────────────────────

function getItemDate(item: MessageCalendarItem): Date {
  if (item.kind === "forecast") {
    return new Date(item.data.forecast_date + "T00:00:00");
  }
  return new Date(item.data.received_at);
}

function getItemId(item: MessageCalendarItem): string {
  if (item.kind === "forecast") return `fc-${item.data.id}`;
  return `msg-${item.data.id}`;
}

function getDetailTitle(item: MessageCalendarItem): string {
  if (item.kind === "forecast") {
    const name = item.data.hospital_name ?? `병원#${item.data.hospital_id}`;
    return `${name} — ${item.data.forecast_date}`;
  }
  return `${item.data.sender ?? "메시지"} — ${formatTime(item.data.received_at)}`;
}

// ─── Main Component ──────────────────────────────

interface MessageCalendarProps {
  messages: CapturedMessage[];
  forecasts?: OrderForecast[];
  hospitals?: Hospital[];
  products?: { id: number; name: string }[];
  initialView: CalendarView;
  initialDate: Date;
  hideHeader?: boolean;
  view?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  referenceDate?: Date;
  onDateChange?: (date: Date) => void;
  onDateDoubleClick?: (date: Date) => void;
}

export function MessageCalendar({
  messages,
  forecasts = [],
  initialView,
  initialDate,
  hideHeader,
  view,
  onViewChange,
  referenceDate,
  onDateChange,
  onDateDoubleClick,
}: MessageCalendarProps) {
  const items: MessageCalendarItem[] = useMemo(() => [
    ...forecasts.map((f) => ({ kind: "forecast" as const, data: f })),
    ...messages.map((m) => ({ kind: "message" as const, data: m })),
  ], [messages, forecasts]);

  return (
    <DataCalendar
      items={items}
      dateAccessor={getItemDate}
      idAccessor={getItemId}
      renderMonthItem={(item) => <MonthItem item={item} />}
      renderWeekItem={(item) => <WeekItem item={item} />}
      renderDayItem={(item) => <DayItem item={item} />}
      renderDetail={(item) => <DetailContent item={item} />}
      detailTitle={getDetailTitle}
      initialView={initialView}
      initialDate={initialDate}
      basePath="/notifications"
      tabParam="calendar"
      hideHeader={hideHeader}
      view={view}
      onViewChange={onViewChange}
      referenceDate={referenceDate}
      onDateChange={onDateChange}
      onDateDoubleClick={onDateDoubleClick}
    />
  );
}
