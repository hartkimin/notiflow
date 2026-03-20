"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeader } from "./calendar-header";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";
import { DayList } from "./day-list";
import { DetailPanel } from "./detail-panel";
import type { CalendarView } from "@/lib/schedule-utils";

interface DataCalendarProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderMonthItem: (item: T) => React.ReactNode;
  renderWeekItem: (item: T) => React.ReactNode;
  renderDayItem: (item: T) => React.ReactNode;
  renderDetail: (item: T) => React.ReactNode;
  detailTitle: (item: T) => string;
  initialView: CalendarView;
  initialDate: Date;
  basePath: string;
  tabParam?: string;
  /** Hide the built-in CalendarHeader (when toolbar is managed externally) */
  hideHeader?: boolean;
  /** Controlled view — overrides internal state when provided */
  view?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Controlled referenceDate — overrides internal state when provided */
  referenceDate?: Date;
  onDateChange?: (date: Date) => void;
  /** Called when a date cell is double-clicked */
  onDateDoubleClick?: (date: Date) => void;
}

export function DataCalendar<T>({
  items, dateAccessor, idAccessor,
  renderMonthItem, renderWeekItem, renderDayItem,
  renderDetail, detailTitle,
  initialView, initialDate, basePath, tabParam = "calendar",
  hideHeader, view: controlledView, onViewChange, referenceDate: controlledDate, onDateChange, onDateDoubleClick,
}: DataCalendarProps<T>) {
  const router = useRouter();
  const [internalView, setInternalView] = useState<CalendarView>(initialView);
  const [internalDate, setInternalDate] = useState<Date>(initialDate);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const view = controlledView ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const referenceDate = controlledDate ?? internalDate;
  const setReferenceDate = onDateChange ?? setInternalDate;

  // The month for which server data is loaded
  const loadedYear = initialDate.getFullYear();
  const loadedMonth = initialDate.getMonth();

  const navigateToDate = useCallback((date: Date) => {
    // Different month → server navigation to fetch new data
    if (date.getMonth() !== loadedMonth || date.getFullYear() !== loadedYear) {
      const m = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      router.push(`${basePath}?tab=${tabParam}&month=${m}&view=${view}`);
      return;
    }
    // Same month → instant client-side state update
    setReferenceDate(date);
  }, [loadedMonth, loadedYear, router, basePath, tabParam, view]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setView("day");
    navigateToDate(today);
  }, [navigateToDate]);

  const handleItemClick = useCallback((item: T) => {
    setSelectedItem(item);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    setView("day");
    navigateToDate(date);
  }, [navigateToDate]);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {!hideHeader && (
        <CalendarHeader
          view={view}
          referenceDate={referenceDate}
          onViewChange={setView}
          onNavigate={navigateToDate}
          onToday={handleToday}
        />
      )}

      {view === "month" && (
        <MonthGrid
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderMonthItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
          onDateClick={handleDateClick}
          onDateDoubleClick={onDateDoubleClick}
        />
      )}

      {view === "week" && (
        <WeekGrid
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderWeekItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
          onDateDoubleClick={onDateDoubleClick}
        />
      )}

      {view === "day" && (
        <DayList
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderDayItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
        />
      )}

      <DetailPanel
        open={selectedItem !== null}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
        title={selectedItem ? detailTitle(selectedItem) : ""}
      >
        {selectedItem && renderDetail(selectedItem)}
      </DetailPanel>
    </div>
  );
}
