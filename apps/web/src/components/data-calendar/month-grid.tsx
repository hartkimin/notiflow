"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { getMonthGridDates, startOfDayMs } from "@/lib/schedule-utils";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface MonthGridProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  referenceDate: Date;
  onItemClick: (item: T) => void;
  onDateClick: (date: Date) => void;
}

export function MonthGrid<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick, onDateClick,
}: MonthGridProps<T>) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);

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
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const rowCount = Math.ceil((firstDayDow + lastDayOfMonth) / 7);
  const cellCount = rowCount * 7;

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

      {/* Grid */}
      <div
        className="grid grid-cols-7 gap-1 flex-1"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {gridDates.slice(0, cellCount).map((date) => {
          const dayMs = startOfDayMs(date);
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dayMs === todayMs;
          const dayItems = itemsByDay.get(dayMs) ?? [];
          const dow = date.getDay();

          return (
            <div
              key={dayMs}
              className={[
                "rounded-lg border p-1.5 text-left flex flex-col min-h-0 overflow-hidden",
                !isCurrentMonth && "opacity-40",
                isToday && "ring-2 ring-primary/50",
              ].filter(Boolean).join(" ")}
            >
              <button
                onClick={() => onDateClick(date)}
                className={[
                  "text-sm font-medium hover:text-primary transition-colors text-left",
                  isToday && "text-primary",
                  dow === 0 && isCurrentMonth && "text-red-500",
                  dow === 6 && isCurrentMonth && "text-blue-500",
                ].filter(Boolean).join(" ")}
              >
                {date.getDate()}
              </button>

              {/* Items */}
              <div className="mt-0.5 flex-1 min-h-0 overflow-hidden space-y-px">
                {dayItems.slice(0, 4).map((item) => (
                  <button
                    key={idAccessor(item)}
                    onClick={() => onItemClick(item)}
                    className="w-full text-left text-[9px] text-muted-foreground truncate leading-tight hover:text-foreground transition-colors"
                  >
                    {renderItem(item)}
                  </button>
                ))}
                {dayItems.length > 4 && (
                  <span className="text-[9px] text-muted-foreground">+{dayItems.length - 4}건</span>
                )}
              </div>

              {/* Count badge */}
              {dayItems.length > 0 && (
                <div className="mt-auto pt-0.5">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                    {dayItems.length}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
