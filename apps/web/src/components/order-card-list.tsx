"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import { updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";
import { toast } from "sonner";

interface OrderGroup {
  order_id: number;
  order_number: string;
  order_date: string;
  hospital_name: string;
  status: string;
  total_amount: number | null;
  total_items: number;
}

interface OrderCardListProps {
  groups: OrderGroup[];
}

const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "confirmed", label: "미완료" },
  { key: "delivered", label: "완료" },
];

export function OrderCardList({ groups }: OrderCardListProps) {
  const router = useRouter();
  const { pullDistance, refreshing, error } = usePullToRefresh();
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = activeFilter === "all"
    ? groups
    : groups.filter((g) => g.status === activeFilter);

  const counts: Record<string, number> = {
    all: groups.length,
    confirmed: groups.filter((g) => g.status === "confirmed").length,
    delivered: groups.filter((g) => g.status === "delivered").length,
  };

  return (
    <div className="space-y-3">
      {/* 풀투리프레시 인디케이터 */}
      {(pullDistance > 0 || refreshing || error) && (
        <div
          className="ptr-spinner"
          style={{ opacity: refreshing || error ? 1 : Math.min(pullDistance / 80, 1) }}
        >
          {error ? (
            <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ) : (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </div>
      )}

      {/* 상태 필터 pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {f.label} {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      {/* 카드 리스트 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <svg className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">주문이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((group) => (
            <SwipeableOrderCard
              key={group.order_id}
              group={group}
              onTap={() => router.push(`/orders/${group.order_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Swipeable Card ─── */

interface SwipeableCardProps {
  group: OrderGroup;
  onTap: () => void;
}

function SwipeableOrderCard({ group, onTap }: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const canSwipe = group.status === "confirmed";
  const threshold = 100; // px

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canSwipe) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  }, [canSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // 방향 결정 (첫 10px 이동에서)
    if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    // 왼쪽 스와이프만 허용
    if (dx < 0) {
      setOffsetX(Math.max(dx, -150));
    }
  }, [swiping]);

  const handleTouchEnd = useCallback(async () => {
    if (!swiping) return;
    setSwiping(false);
    isHorizontal.current = null;

    if (Math.abs(offsetX) >= threshold) {
      // 상태 변경 실행
      try {
        await updateOrderStatusAction(group.order_id, "delivered");
        toast.success("완료 처리됨");
      } catch {
        toast.error("상태 변경 실패");
      }
    }
    setOffsetX(0);
  }, [swiping, offsetX, group.order_id]);

  const formatAmount = (amount: number | null) => {
    if (amount == null) return "—";
    return `₩${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "오늘";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "어제";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* 스와이프 시 뒤에 보이는 액션 영역 */}
      {canSwipe && offsetX < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-center bg-green-600 text-white text-xs font-medium px-4"
          style={{ width: Math.abs(offsetX) }}
        >
          {Math.abs(offsetX) >= threshold ? "놓으면 완료" : "완료 처리"}
        </div>
      )}

      {/* 카드 본체 */}
      <div
        ref={cardRef}
        className={cn(
          "relative rounded-lg border bg-card p-3.5 active:bg-accent/30 transition-colors",
          swiping ? "" : "transition-transform duration-200",
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
          willChange: swiping ? "transform" : "auto",
        }}
        onClick={() => { if (!swiping && offsetX === 0) onTap(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Row 1: 주문번호 + 상태 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold">{group.order_number}</span>
          <Badge variant={ORDER_STATUS_VARIANT[group.status] ?? "secondary"} className="text-[10px]">
            {ORDER_STATUS_LABELS[group.status] || group.status}
          </Badge>
        </div>

        {/* Row 2: 병원명 */}
        <p className="text-xs text-muted-foreground mb-1.5 truncate">
          {group.hospital_name}
        </p>

        {/* Row 3: 금액 + 품목수/날짜 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {formatAmount(group.total_amount)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {group.total_items}개 품목 · {formatDate(group.order_date)}
          </span>
        </div>
      </div>
    </div>
  );
}
