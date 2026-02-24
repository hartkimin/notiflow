"use client";

import { Badge } from "@/components/ui/badge";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { RawMessage } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  kakaotalk: "카카오톡",
  sms: "SMS",
  telegram: "텔레그램",
  manual: "수동",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  parsed: "default",
  pending: "secondary",
  failed: "destructive",
  skipped: "outline",
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(dateStr)}`;
}

// --- Renderers ---

function MonthItem({ msg }: { msg: RawMessage }) {
  return (
    <span>
      <span className="font-medium">{msg.sender ?? "?"}</span>{" "}
      {msg.content?.slice(0, 20)}
    </span>
  );
}

function WeekItem({ msg }: { msg: RawMessage }) {
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

function DayItem({ msg }: { msg: RawMessage }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{msg.sender ?? "?"}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[msg.source_app] ?? msg.source_app}</Badge>
          <Badge variant={STATUS_VARIANTS[msg.parse_status] ?? "secondary"} className="text-[10px]">
            {msg.parse_status === "parsed" ? "파싱완료" : msg.parse_status === "pending" ? "대기" : msg.parse_status === "failed" ? "실패" : msg.parse_status}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(msg.received_at)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{msg.content}</p>
      {msg.device_name && (
        <span className="text-xs text-muted-foreground mt-1">기기: {msg.device_name}</span>
      )}
    </div>
  );
}

function DetailContent({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result as { items?: Array<{ item: string; qty: number; unit: string; matched_product?: string; confidence?: number }> } | null;

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
          <p><Badge variant="outline">{SOURCE_LABELS[msg.source_app] ?? msg.source_app}</Badge></p>
        </div>
        <div>
          <span className="text-muted-foreground">파싱상태</span>
          <p><Badge variant={STATUS_VARIANTS[msg.parse_status] ?? "secondary"}>{msg.parse_status}</Badge></p>
        </div>
        {msg.device_name && (
          <div>
            <span className="text-muted-foreground">기기</span>
            <p className="font-medium">{msg.device_name}</p>
          </div>
        )}
        {msg.order_id && (
          <div>
            <span className="text-muted-foreground">주문</span>
            <p><a href={`/orders/${msg.order_id}`} className="text-primary hover:underline">#{msg.order_id}</a></p>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-1">메시지 내용</h4>
        <div className="rounded border p-3 text-sm whitespace-pre-wrap bg-muted/30">
          {msg.content}
        </div>
      </div>

      {parseResult?.items && parseResult.items.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">파싱 결과</h4>
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">품목</th>
                  <th className="text-right px-2 py-1 font-medium">수량</th>
                  <th className="text-left px-2 py-1 font-medium">단위</th>
                  <th className="text-left px-2 py-1 font-medium">매칭</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.items.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{item.item}</td>
                    <td className="px-2 py-1 text-right">{item.qty}</td>
                    <td className="px-2 py-1">{item.unit}</td>
                    <td className="px-2 py-1 text-muted-foreground">{item.matched_product ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

interface MessageCalendarProps {
  messages: RawMessage[];
  view: CalendarView;
  referenceDate: Date;
}

export function MessageCalendar({ messages, view, referenceDate }: MessageCalendarProps) {
  return (
    <DataCalendar
      items={messages}
      dateAccessor={(m) => new Date(m.received_at)}
      idAccessor={(m) => m.id}
      renderMonthItem={(m) => <MonthItem msg={m} />}
      renderWeekItem={(m) => <WeekItem msg={m} />}
      renderDayItem={(m) => <DayItem msg={m} />}
      renderDetail={(m) => <DetailContent msg={m} />}
      detailTitle={(m) => `${m.sender ?? "메시지"} — ${formatTime(m.received_at)}`}
      view={view}
      referenceDate={referenceDate}
      basePath="/messages"
      tabParam="calendar"
    />
  );
}
