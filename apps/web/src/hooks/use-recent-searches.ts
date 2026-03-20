"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "mfds-recent-searches";
const MAX_ITEMS = 5;

export interface RecentSearch {
  query: string;
  tab: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearch[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((next: RecentSearch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const add = useCallback(
    (query: string, tab: string) => {
      setItems((prev) => {
        // Remove existing entry with same query+tab
        const filtered = prev.filter(
          (item) => !(item.query === query && item.tab === tab),
        );
        const entry: RecentSearch = { query, tab, timestamp: Date.now() };
        const next = [entry, ...filtered].slice(0, MAX_ITEMS);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setItems([]);
  }, []);

  return { items, add, clear };
}
