"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UsePullToRefreshOptions {
  /** 새로고침 트리거 임계값 (px). 기본 80 */
  threshold?: number;
  /** 스크롤 컨테이너 선택자. 기본 "main" */
  scrollContainer?: string;
}

export function usePullToRefresh(options: UsePullToRefreshOptions = {}) {
  const { threshold = 80, scrollContainer = "main" } = options;
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    const container = document.querySelector(scrollContainer);
    if (!container || container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing, scrollContainer]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      e.preventDefault();
      setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
    }
  }, [threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setError(false);
      try {
        router.refresh();
        await new Promise((r) => setTimeout(r, 600));
      } catch {
        setError(true);
        setTimeout(() => setError(false), 1000);
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, threshold, router]);

  useEffect(() => {
    // 터치 디바이스가 아니면 등록하지 않음
    if (!("ontouchstart" in window)) return;

    const container = document.querySelector(scrollContainer);
    if (!container) return;

    container.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
    container.addEventListener("touchmove", onTouchMove as EventListener, { passive: false });
    container.addEventListener("touchend", onTouchEnd as EventListener, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart as EventListener);
      container.removeEventListener("touchmove", onTouchMove as EventListener);
      container.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, [scrollContainer, onTouchStart, onTouchMove, onTouchEnd]);

  return { pullDistance, refreshing, error };
}
