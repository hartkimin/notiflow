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
  onDateDoubleClick?: (date: Date) => void;
}

export function MonthGrid<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick, onDateClick, onDateDoubleClick,
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
        className="grid grid-cols-7 gap-1 flex-1 min-h-0 overflow-hidden"
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
              onDoubleClick={() => onDateDoubleClick?.(date)}
              className={[
                "rounded-lg border p-1.5 text-left flex flex-col min-h-0 overflow-hidden",
                !isCurrentMonth && "opacity-40",
                isToday && "ring-2 ring-primary/50",
              ].filter(Boolean).join(" ")}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onDateClick(date)}
                  className={[
                    "text-sm font-semibold hover:text-primary transition-colors text-left",
                    isToday && "text-primary",
                    dow === 0 && isCurrentMonth && "text-red-500",
                    dow === 6 && isCurrentMonth && "text-blue-500",
                  ].filter(Boolean).join(" ")}
                >
                  {date.getDate()}
                </button>
                {dayItems.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-medium">
                    {dayItems.length}
                  </Badge>
                )}
              </div>

              {/* Items + Count */}
              {dayItems.length > 0 && (
                <div className="mt-0.5 flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="space-y-px overflow-hidden flex-1 min-h-0">
                    {dayItems.slice(0, 3).map((item) => (
                      <button
                        key={idAccessor(item)}
                        onClick={() => onItemClick(item)}
                        className="w-full text-left text-[10px] text-muted-foreground truncate leading-snug hover:text-foreground transition-colors py-px"
                      >
                        {renderItem(item)}
                      </button>
                    ))}
                  </div>
                  {dayItems.length > 3 && (
                    <div className="shrink-0 mt-auto">
                      <span className="text-[9px] text-muted-foreground font-medium">+{dayItems.length - 3}건 더보기</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
