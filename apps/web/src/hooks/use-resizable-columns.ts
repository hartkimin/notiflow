"use client";

import { useState, useCallback, useRef } from "react";

export function useResizableColumns(storageKey: string, defaultWidths: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return defaultWidths;
    try {
      const stored = localStorage.getItem(`col-widths-${storageKey}`);
      if (stored) return { ...defaultWidths, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    return defaultWidths;
  });

  const dragRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const onMouseDown = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[col] ?? defaultWidths[col] ?? 100;
    dragRef.current = { col, startX, startW };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      const newW = Math.max(40, dragRef.current.startW + diff);
      setWidths((prev) => {
        const next = { ...prev, [dragRef.current!.col]: newW };
        try { localStorage.setItem(`col-widths-${storageKey}`, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    };

    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [widths, defaultWidths, storageKey]);

  return { widths, onMouseDown };
}
