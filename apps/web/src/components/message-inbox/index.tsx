"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MessageTable } from "./message-table";
import { BulkActionBar } from "./bulk-action-bar";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { useRowSelection } from "@/hooks/use-row-selection";
import type { UnifiedMessage } from "@/lib/queries/messages";

interface MessageInboxProps {
  messages: UnifiedMessage[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageInbox({
  messages, currentPage, totalPages, totalCount,
}: MessageInboxProps) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const localState = useMessageLocalState();
  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <MessageTable
        messages={messages}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        localState={localState}
        rowSelection={rowSelection}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        highlightId={highlightId}
      />
      <BulkActionBar rowSelection={rowSelection} />
    </div>
  );
}
