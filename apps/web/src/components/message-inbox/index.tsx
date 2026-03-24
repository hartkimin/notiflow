"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { MessageTable } from "./message-table";
import { AccordionDetail } from "./accordion-detail";
import { BulkActionBar } from "./bulk-action-bar";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { useRowSelection } from "@/hooks/use-row-selection";
import { markMessagesAsRead } from "@/lib/actions";
import type { UnifiedMessage, LinkedOrder } from "@/lib/queries/messages";

interface MessageInboxProps {
  messages: UnifiedMessage[];
  linkedOrders?: Record<string, LinkedOrder>;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageInbox({
  messages, linkedOrders, currentPage, totalPages, totalCount,
}: MessageInboxProps) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const localState = useMessageLocalState();
  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);
  const router = useRouter();

  const selectedMsg = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    // Mark as read when selecting an unread message
    const msg = messages.find((m) => m.id === id);
    if (msg && msg.is_read === false) {
      markMessagesAsRead([id]).then(() => router.refresh());
    }
  }, [messages, router]);

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-0">
      {/* Left: Table */}
      <div className="flex-1 border rounded-l-lg overflow-hidden min-w-0">
        <MessageTable
          messages={messages}
          expandedId={selectedId}
          onToggleExpand={handleSelect}
          localState={localState}
          rowSelection={rowSelection}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          highlightId={highlightId}
        />
      </div>

      {/* Right: Detail Panel */}
      <div className="w-[380px] shrink-0 border-y border-r rounded-r-lg overflow-hidden bg-background">
        {selectedMsg ? (
          <AccordionDetail message={selectedMsg} localState={localState} linkedOrder={linkedOrders?.[selectedMsg.id]} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">메시지를 선택하세요</p>
          </div>
        )}
      </div>

      <BulkActionBar rowSelection={rowSelection} />
    </div>
  );
}
