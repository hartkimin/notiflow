"use client";

import { useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/pagination";
import { MessageRow } from "./message-row";
import type { UnifiedMessage, LinkedOrder } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

type StringRowSelection = RowSelectionHook<string>;

interface MessageTableProps {
  messages: UnifiedMessage[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  localState: MessageLocalStateHook;
  rowSelection: StringRowSelection;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  highlightId?: string | null;
  linkedOrders?: Record<string, LinkedOrder>;
}

export function MessageTable({
  messages, expandedId, onToggleExpand, localState, rowSelection,
  currentPage, totalPages, totalCount, highlightId, linkedOrders,
}: MessageTableProps) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to highlighted row on mount
  useEffect(() => {
    if (highlightId) {
      const el = rowRefs.current.get(highlightId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="grid grid-cols-[36px_110px_65px_100px_1fr_75px_110px] items-center gap-1 px-3 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0 z-10">
        <div>
          <Checkbox
            checked={rowSelection.someSelected ? "indeterminate" : rowSelection.allSelected}
            onCheckedChange={() => rowSelection.toggleAll()}
          />
        </div>
        <span>수신시간</span>
        <span>출처</span>
        <span>발신자</span>
        <span>내용</span>
        <span className="text-center">상태</span>
        <span className="text-right">주문</span>
      </div>

      {/* Row list */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">수신된 메시지가 없습니다.</p>
        ) : (
          messages.map((msg) => (
            <MessageRow
              key={msg.id}
              ref={(el: HTMLDivElement | null) => {
                if (el) rowRefs.current.set(msg.id, el);
                else rowRefs.current.delete(msg.id);
              }}
              message={msg}
              isExpanded={expandedId === msg.id}
              onToggleExpand={() => onToggleExpand(msg.id)}
              localState={localState}
              rowSelection={rowSelection}
              linkedOrder={linkedOrders?.[msg.id]}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="border-t px-3 py-2">
        <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} />
      </div>
    </div>
  );
}
