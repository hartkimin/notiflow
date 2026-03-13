"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageInbox } from "@/components/message-inbox";
import { MessageCalendar } from "@/components/message-calendar";
import { CreateMessageDialog } from "@/components/message-list";
import { ForecastDialog } from "@/components/forecast-dialog";
import { ForecastBatchDialog } from "@/components/forecast-batch-dialog";
import {
  formatWeekLabel, formatMonthLabel, formatDayLabel, getWeekMonday,
  toLocalDateStr,
} from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";
import type { RawMessage, Hospital, Product, OrderForecast } from "@/lib/types";

// ─── Types ──────────────────────────────────────

type TabValue = "list" | "calendar";

interface MessagesViewProps {
  initialTab: TabValue;
  // List data
  messages: RawMessage[];
  hospitals: Hospital[];
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  // Calendar data
  calendarMessages: RawMessage[];
  calendarForecasts: OrderForecast[];
  initialCalView: CalendarView;
  initialCalDate: Date;
}

// ─── Component ──────────────────────────────────

export function MessagesView({
  initialTab,
  messages, hospitals, products,
  currentPage, totalPages, totalCount,
  calendarMessages, calendarForecasts, initialCalView, initialCalDate,
}: MessagesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state
  const [tab, setTab] = useState<TabValue>(initialTab);

  // Calendar state (lifted from DataCalendar for toolbar control)
  const [calView, setCalView] = useState<CalendarView>(initialCalView);
  const [calDate, setCalDate] = useState<Date>(initialCalDate);

  // Forecast dialog state
  const [forecastDialogOpen, setForecastDialogOpen] = useState(false);
  const [forecastDialogDate, setForecastDialogDate] = useState<string | undefined>();
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // Loaded month for calendar server-navigation check
  const loadedYear = initialCalDate.getFullYear();
  const loadedMonth = initialCalDate.getMonth();

  // ─── Tab switching ──────────────────────────────
  const handleTabChange = useCallback((value: TabValue) => {
    setTab(value);
    const url = value === "list" ? "/messages" : "/messages?tab=calendar";
    window.history.replaceState(null, "", url);
  }, []);

  // ─── Calendar navigation ────────────────────────
  const navigateCalDate = useCallback((date: Date) => {
    if (date.getMonth() !== loadedMonth || date.getFullYear() !== loadedYear) {
      const m = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/messages?tab=calendar&month=${m}`);
      return;
    }
    setCalDate(date);
  }, [loadedMonth, loadedYear, router]);

  const handleCalPrev = useCallback(() => {
    const d = new Date(calDate);
    if (calView === "day") d.setDate(d.getDate() - 1);
    else if (calView === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    navigateCalDate(d);
  }, [calDate, calView, navigateCalDate]);

  const handleCalNext = useCallback(() => {
    const d = new Date(calDate);
    if (calView === "day") d.setDate(d.getDate() + 1);
    else if (calView === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    navigateCalDate(d);
  }, [calDate, calView, navigateCalDate]);

  const handleCalToday = useCallback(() => {
    setCalView("day");
    navigateCalDate(new Date());
  }, [navigateCalDate]);

  const handleDateDoubleClick = useCallback((date: Date) => {
    setForecastDialogDate(toLocalDateStr(date));
    setForecastDialogOpen(true);
  }, []);

  const calLabel =
    calView === "day" ? formatDayLabel(calDate) :
    calView === "week" ? formatWeekLabel(getWeekMonday(calDate)) :
    formatMonthLabel(calDate);

  // ─── List filter submit ─────────────────────────
  const pendingCount = messages.filter(
    (m) => m.parse_status === "pending" || m.parse_status === "failed",
  ).length;

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const parse_status = fd.get("parse_status") as string;
    const source_app = fd.get("source_app") as string;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (parse_status && parse_status !== "all") params.set("parse_status", parse_status);
    if (source_app && source_app !== "all") params.set("source_app", source_app);
    router.push(`/messages?${params}`);
  }

  // ─── Render ─────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">
      {/* ──── Unified Toolbar ──── */}
      <div className="flex items-center gap-2 py-1.5">
        {/* Tab toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border p-0.5 shrink-0">
          <button
            onClick={() => handleTabChange("list")}
            className={[
              "px-3 py-1 text-xs rounded-md transition-colors",
              tab === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            ].join(" ")}
          >
            목록
          </button>
          <button
            onClick={() => handleTabChange("calendar")}
            className={[
              "px-3 py-1 text-xs rounded-md transition-colors",
              tab === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            ].join(" ")}
          >
            캘린더
          </button>
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Mode-specific controls */}
        {tab === "list" ? (
          <form onSubmit={handleFilterSubmit} className="flex items-center gap-2 flex-1 min-w-0">
            <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="h-8 w-[120px] text-xs" />
            <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="h-8 w-[120px] text-xs" />
            <Select name="parse_status" defaultValue={searchParams.get("parse_status") || "all"}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="parsed">파싱완료</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
                <SelectItem value="skipped">건너뜀</SelectItem>
              </SelectContent>
            </Select>
            <Select name="source_app" defaultValue={searchParams.get("source_app") || "all"}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 출처</SelectItem>
                <SelectItem value="kakaotalk">카카오톡</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="telegram">텔레그램</SelectItem>
                <SelectItem value="manual">수동</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
              <Search className="h-3.5 w-3.5" />
            </Button>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              <span>전체 <strong className="text-foreground">{totalCount}</strong>건</span>
              {pendingCount > 0 && (
                <span>· 미처리 <strong className="text-orange-600">{pendingCount}</strong>건</span>
              )}
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCalPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleCalToday}>
              오늘
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCalNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold whitespace-nowrap">{calLabel}</span>

            <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5 shrink-0">
              {(["day", "week", "month"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={[
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    calView === v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  ].join(" ")}
                >
                  {v === "day" ? "일" : v === "week" ? "주" : "월"}
                </button>
              ))}
            </div>

            {/* Forecast buttons */}
            <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setForecastDialogOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />예상 등록
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setBatchDialogOpen(true)}>
              <CalendarRange className="h-3.5 w-3.5 mr-1" />주간 예상
            </Button>
          </div>
        )}

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Create button */}
        <CreateMessageDialog />
      </div>

      {/* ──── Content ──── */}
      {tab === "list" ? (
        <MessageInbox
          messages={messages}
          hospitals={hospitals}
          products={products}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      ) : (
        <MessageCalendar
          messages={calendarMessages}
          forecasts={calendarForecasts}
          hospitals={hospitals}
          products={products}
          initialView={initialCalView}
          initialDate={initialCalDate}
          hideHeader
          view={calView}
          onViewChange={setCalView}
          referenceDate={calDate}
          onDateChange={navigateCalDate}
          onDateDoubleClick={handleDateDoubleClick}
        />
      )}
      <ForecastDialog
        open={forecastDialogOpen}
        onOpenChange={setForecastDialogOpen}
        hospitals={hospitals}
        products={products}
        initialDate={forecastDialogDate}
      />
      <ForecastBatchDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        hospitals={hospitals}
        products={products}
        referenceDate={calDate}
      />
    </div>
  );
}
