"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PortalSearchBoxProps<T extends { id: number; name: string }> {
  placeholder: string;
  onSelect: (item: T) => void;
  fetchRecent: () => Promise<T[]>;
  searchAction: (query: string) => Promise<T[]>;
  renderItem?: (item: T) => React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PortalSearchBox<T extends { id: number; name: string }>({
  placeholder,
  onSelect,
  fetchRecent,
  searchAction,
  renderItem,
  className,
  disabled,
}: PortalSearchBoxProps<T>) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRecentRef = useRef(fetchRecent);

  // Reset when fetchRecent identity changes (e.g., hospitalId changes)
  useEffect(() => {
    fetchRecentRef.current = fetchRecent;
    setItems([]);
    setQuery("");
  }, [fetchRecent]);

  // Load recent items on focus
  const handleFocus = useCallback(async () => {
    if (disabled) return;
    setIsOpen(true);
    if (query.length === 0) {
      setIsLoading(true);
      try {
        const recent = await fetchRecentRef.current();
        setItems(recent);
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [query, disabled]);

  // Search on query change
  useEffect(() => {
    if (!isOpen || query.length === 0) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchAction(query);
        setItems(results);
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchAction, isOpen]);

  // Show recent when query is cleared
  useEffect(() => {
    if (isOpen && query.length === 0) {
      let cancelled = false;
      setIsLoading(true);
      fetchRecentRef.current().then((data) => {
        if (!cancelled) { setItems(data); setIsLoading(false); }
      });
      return () => { cancelled = true; };
    }
  }, [query, isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          onSelect(items[activeIndex]);
          setIsOpen(false);
          setQuery("");
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  function handleSelect(item: T) {
    onSelect(item);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="pl-8"
        />
        {isLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[300px] overflow-y-auto animate-in slide-in-from-top-1 fade-in duration-150">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {isLoading ? "검색 중..." : query ? "검색 결과 없음" : "최근 항목 없음"}
            </p>
          ) : (
            <>
              {!query && (
                <div className="px-3 py-1.5 border-b bg-muted/30 text-[11px] text-muted-foreground">
                  최근 사용
                </div>
              )}
              {items.map((item, idx) => (
                <button
                  key={`${item.id}-${item.name}-${idx}`}
                  type="button"
                  className={`flex w-full items-center px-3 py-2 text-sm text-left border-b last:border-b-0 transition-colors ${
                    idx === activeIndex ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  {renderItem ? renderItem(item) : item.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
