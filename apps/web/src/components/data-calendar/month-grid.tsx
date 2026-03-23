"use client";

import { useMemo, useState, useRef, useEffect } from "react";
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

function DayPopover<T>({
  items,
  date,
  idAccessor,
  renderItem,
  onItemClick,
  onClose,
}: {
  items: T[];
  date: Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  onItemClick: (item: T) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-0 left-0 right-0 bg-popover border rounded-lg shadow-xl p-2 max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-xs font-semibold">{date.getMonth() + 1}/{date.getDate()} — {items.length}건</span>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <button
            key={idAccessor(item)}
            onClick={() => { onItemClick(item); onClose(); }}
            className="w-full text-left text-[11px] text-muted-foreground truncate leading-snug hover:text-foreground hover:bg-muted/50 transition-colors py-1 px-1.5 rounded"
          >
            {renderItem(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MonthGrid<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick, onDateClick, onDateDoubleClick,
}: MonthGridProps<T>) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);
  const [expandedDayMs, setExpandedDayMs] = useState<number | null>(null);

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
          const isExpanded = expandedDayMs === dayMs;
          const overflowCount = dayItems.length - 3;

          return (
            <div
              key={dayMs}
              onDoubleClick={() => onDateDoubleClick?.(date)}
              className={[
                "rounded-lg border p-1.5 text-left flex flex-col min-h-0 overflow-hidden relative",
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
                  <button
                    onClick={() => setExpandedDayMs(isExpanded ? null : dayMs)}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Badge variant={dayItems.length > 5 ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-4 font-medium cursor-pointer">
                      {dayItems.length}
                    </Badge>
                  </button>
                )}
              </div>

              {/* Items preview */}
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
                  {overflowCount > 0 && (
                    <button
                      className="shrink-0 mt-auto text-left"
                      onClick={() => setExpandedDayMs(isExpanded ? null : dayMs)}
                    >
                      <span className="text-[9px] text-primary font-medium hover:underline cursor-pointer">
                        +{overflowCount}건 더보기
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Expanded popover */}
              {isExpanded && dayItems.length > 0 && (
                <DayPopover
                  items={dayItems}
                  date={date}
                  idAccessor={idAccessor}
                  renderItem={renderItem}
                  onItemClick={onItemClick}
                  onClose={() => setExpandedDayMs(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
