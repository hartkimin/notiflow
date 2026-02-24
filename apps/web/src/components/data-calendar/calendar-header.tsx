"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatWeekLabel, formatMonthLabel, formatDayLabel,
  getWeekMonday, toLocalDateStr,
} from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

interface CalendarHeaderProps {
  view: CalendarView;
  referenceDate: Date;
  basePath: string;
  tabParam: string;
}

export function CalendarHeader({ view, referenceDate, basePath, tabParam }: CalendarHeaderProps) {
  const router = useRouter();

  function buildUrl(v: CalendarView, date: Date) {
    const params = new URLSearchParams();
    params.set("tab", tabParam);
    params.set("view", v);
    if (v === "day") {
      params.set("date", toLocalDateStr(date));
    } else if (v === "week") {
      params.set("week", toLocalDateStr(getWeekMonday(date)));
    } else {
      params.set("month", `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    return `${basePath}?${params.toString()}`;
  }

  function navigate(direction: -1 | 1) {
    const d = new Date(referenceDate);
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    router.push(buildUrl(view, d));
  }

  function goToday() {
    router.push(buildUrl(view, new Date()));
  }

  function switchView(v: CalendarView) {
    router.push(buildUrl(v, referenceDate));
  }

  const label =
    view === "day" ? formatDayLabel(referenceDate) :
    view === "week" ? formatWeekLabel(referenceDate) :
    formatMonthLabel(referenceDate);

  return (
    <div className="flex items-center gap-2 py-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
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
            onClick={() => switchView(v)}
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
