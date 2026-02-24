"use client";

import { useMemo } from "react";
import { startOfDayMs } from "@/lib/schedule-utils";

interface DayListProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  referenceDate: Date;
  onItemClick: (item: T) => void;
}

export function DayList<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick,
}: DayListProps<T>) {
  const dayMs = startOfDayMs(referenceDate);

  const dayItems = useMemo(() => {
    return items.filter((item) => startOfDayMs(dateAccessor(item)) === dayMs);
  }, [items, dateAccessor, dayMs]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
      {dayItems.map((item) => (
        <button
          key={idAccessor(item)}
          onClick={() => onItemClick(item)}
          className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
        >
          {renderItem(item)}
        </button>
      ))}
      {dayItems.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          이 날짜에 데이터가 없습니다
        </p>
      )}
    </div>
  );
}
