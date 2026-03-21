"use client";

import { useState, useMemo, useCallback } from "react";

export function useRowSelection<T extends string | number>(allIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === allIds.length && allIds.every((id) => prev.has(id))) {
        return new Set<T>();
      }
      return new Set(allIds);
    });
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set<T>()), []);

  const count = useMemo(
    () => allIds.filter((id) => selected.has(id)).length,
    [allIds, selected],
  );

  const allSelected = count > 0 && count === allIds.length;
  const someSelected = count > 0 && count < allIds.length;

  return { selected, toggle, toggleAll, clear, count, allSelected, someSelected };
}

export type RowSelectionHook = ReturnType<typeof useRowSelection>;
