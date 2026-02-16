"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Provides periodic auto-refresh and a manual sync button.
 * Rendered in the dashboard layout; interval is read from settings.
 */
export function AutoRefreshProvider({
  intervalMinutes,
}: {
  intervalMinutes: number;
}) {
  const router = useRouter();
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [spinning, setSpinning] = useState(false);

  const doRefresh = useCallback(() => {
    router.refresh();
    setLastSync(new Date());
    setSpinning(true);
    setTimeout(() => setSpinning(false), 800);
  }, [router]);

  // Periodic auto-refresh
  useEffect(() => {
    if (intervalMinutes <= 0) return;
    const ms = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      doRefresh();
    }, ms);
    return () => clearInterval(timer);
  }, [intervalMinutes, doRefresh]);

  const timeAgo = useTimeAgo(lastSync);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={doRefresh}
          >
            <RefreshCw
              className={`h-4 w-4 transition-transform ${spinning ? "animate-spin" : ""}`}
            />
            <span className="sr-only">동기화</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            마지막 동기화: {timeAgo}
            <br />
            자동 동기화: {intervalMinutes}분 간격
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function useTimeAgo(date: Date) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return "방금 전";
  if (diff < 60) return `${diff}초 전`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}분 전`;
  return `${Math.floor(mins / 60)}시간 전`;
}
