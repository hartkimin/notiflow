"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getMonthGridDates, startOfDayMs, argbToHex, toLocalDateStr } from "@/lib/schedule-utils";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface MonthViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  referenceDate: Date; // 1st of the month
}

export function MonthView({
  categories, plans, dayCategories, messages, referenceDate,
}: MonthViewProps) {
  const router = useRouter();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const dayCatsByDay = useMemo(() => {
    const map = new Map<number, DayCategory[]>();
    for (const dc of dayCategories) map.set(dc.date, [...(map.get(dc.date) ?? []), dc]);
    return map;
  }, [dayCategories]);

  const messageCountByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of messages) {
      const dayMs = startOfDayMs(new Date(m.received_at));
      map.set(dayMs, (map.get(dayMs) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  const planCountByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of plans) {
      map.set(p.date, (map.get(p.date) ?? 0) + 1);
    }
    return map;
  }, [plans]);

  const todayMs = startOfDayMs(new Date());

  // Determine row count (5 or 6)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const rowCount = Math.ceil((firstDayDow + lastDayOfMonth) / 7);
  const cellCount = rowCount * 7;

  function handleDateClick(date: Date) {
    router.push(`/calendar?view=day&date=${toLocalDateStr(date)}`);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={[
              "text-center text-xs font-medium py-1",
              i === 6 && "text-red-500",
              i === 5 && "text-blue-500",
            ].filter(Boolean).join(" ")}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7 gap-1 flex-1"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {gridDates.slice(0, cellCount).map((date) => {
          const dayMs = startOfDayMs(date);
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dayMs === todayMs;
          const dayCats = dayCatsByDay.get(dayMs) ?? [];
          const msgCount = messageCountByDay.get(dayMs) ?? 0;
          const planCount = planCountByDay.get(dayMs) ?? 0;

          return (
            <button
              key={dayMs}
              onClick={() => handleDateClick(date)}
              className={[
                "rounded-lg border p-1.5 text-left transition-colors hover:bg-muted/50 flex flex-col min-h-0 overflow-hidden",
                !isCurrentMonth && "opacity-40",
                isToday && "ring-2 ring-primary/50",
              ].filter(Boolean).join(" ")}
            >
              <span className={[
                "text-sm font-medium",
                isToday && "text-primary",
                date.getDay() === 0 && isCurrentMonth && "text-red-500",
                date.getDay() === 6 && isCurrentMonth && "text-blue-500",
              ].filter(Boolean).join(" ")}>
                {date.getDate()}
              </span>

              {/* Category dots */}
              {dayCats.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayCats.slice(0, 5).map((dc) => {
                    const cat = categoryMap.get(dc.category_id);
                    if (!cat) return null;
                    return (
                      <span
                        key={dc.id}
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: argbToHex(cat.color) }}
                      />
                    );
                  })}
                  {dayCats.length > 5 && (
                    <span className="text-[9px] text-muted-foreground">+{dayCats.length - 5}</span>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="mt-auto flex items-center gap-1 flex-wrap">
                {planCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {planCount}건
                  </span>
                )}
                {msgCount > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {msgCount}
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
