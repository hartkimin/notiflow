"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatWeekLabel, formatMonthLabel, formatDayLabel, getWeekMonday,
} from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

interface CalendarHeaderProps {
  view: CalendarView;
  referenceDate: Date;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (date: Date) => void;
  onToday: () => void;
}

export function CalendarHeader({
  view, referenceDate, onViewChange, onNavigate, onToday,
}: CalendarHeaderProps) {
  function navigate(direction: -1 | 1) {
    const d = new Date(referenceDate);
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    onNavigate(d);
  }

  const label =
    view === "day" ? formatDayLabel(referenceDate) :
    view === "week" ? formatWeekLabel(getWeekMonday(referenceDate)) :
    formatMonthLabel(referenceDate);

  return (
    <div className="flex items-center gap-2 py-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" className="h-8" onClick={onToday}>
        오늘
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="text-sm font-semibold ml-2">{label}</span>

      <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
        {(["day", "week", "month"] as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={[
              "px-3 py-1 text-xs rounded-md transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            ].join(" ")}
          >
            {v === "day" ? "일" : v === "week" ? "주" : "월"}
          </button>
        ))}
      </div>
    </div>
  );
}
