"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { getWeekDates, startOfDayMs } from "@/lib/schedule-utils";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface WeekGridProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  referenceDate: Date; // Monday
  onItemClick: (item: T) => void;
}

export function WeekGrid<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick,
}: WeekGridProps<T>) {
  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, T[]>();
    for (const item of items) {
      const dayMs = startOfDayMs(dateAccessor(item));
      const arr = map.get(dayMs);
      if (arr) arr.push(item);
      else map.set(dayMs, [item]);
    }
    return map;
  }, [items, dateAccessor]);

  const todayMs = startOfDayMs(new Date());

  return (
    <div className="grid grid-cols-7 gap-2 flex-1 min-h-0">
      {weekDates.map((date, i) => {
        const dayMs = startOfDayMs(date);
        const isToday = dayMs === todayMs;
        const dayItems = itemsByDay.get(dayMs) ?? [];

        return (
          <div
            key={dayMs}
            className={[
              "flex flex-col rounded-lg border min-h-0",
              isToday && "ring-2 ring-primary/50",
            ].filter(Boolean).join(" ")}
          >
            {/* Day header */}
            <div className={[
              "px-2 py-1.5 border-b text-center",
              isToday && "bg-primary/5",
            ].filter(Boolean).join(" ")}>
              <span className={[
                "text-xs font-medium",
                i === 6 && "text-red-500",
                i === 5 && "text-blue-500",
              ].filter(Boolean).join(" ")}>
                {DAY_LABELS[i]}
              </span>
              <span className={[
                "ml-1 text-sm font-semibold",
                isToday && "text-primary",
              ].filter(Boolean).join(" ")}>
                {date.getDate()}
              </span>
              {dayItems.length > 0 && (
                <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-3.5">
                  {dayItems.length}
                </Badge>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {dayItems.map((item) => (
                <button
                  key={idAccessor(item)}
                  onClick={() => onItemClick(item)}
                  className="w-full text-left rounded border p-1.5 hover:bg-muted/50 transition-colors"
                >
                  {renderItem(item)}
                </button>
              ))}
              {dayItems.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">-</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
