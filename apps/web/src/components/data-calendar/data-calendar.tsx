"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeader } from "./calendar-header";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";
import { DayList } from "./day-list";
import { DetailPanel } from "./detail-panel";
import type { CalendarView } from "@/lib/schedule-utils";
import { toLocalDateStr } from "@/lib/schedule-utils";

interface DataCalendarProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderMonthItem: (item: T) => React.ReactNode;
  renderWeekItem: (item: T) => React.ReactNode;
  renderDayItem: (item: T) => React.ReactNode;
  renderDetail: (item: T) => React.ReactNode;
  detailTitle: (item: T) => string;
  view: CalendarView;
  referenceDate: Date;
  basePath: string;
  tabParam?: string;
}

export function DataCalendar<T>({
  items, dateAccessor, idAccessor,
  renderMonthItem, renderWeekItem, renderDayItem,
  renderDetail, detailTitle,
  view, referenceDate, basePath, tabParam = "calendar",
}: DataCalendarProps<T>) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const handleItemClick = useCallback((item: T) => {
    setSelectedItem(item);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    const params = new URLSearchParams();
    params.set("tab", tabParam);
    params.set("view", "day");
    params.set("date", toLocalDateStr(date));
    router.push(`${basePath}?${params.toString()}`);
  }, [router, basePath, tabParam]);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <CalendarHeader
        view={view}
        referenceDate={referenceDate}
        basePath={basePath}
        tabParam={tabParam}
      />

      {view === "month" && (
        <MonthGrid
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderMonthItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
          onDateClick={handleDateClick}
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
