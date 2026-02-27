"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pin } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, formatDate } from "./constants";
import type { CapturedMessage } from "@/lib/types";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

type SortKey = "received_at" | "sender";

interface ListPanelProps {
  messages: CapturedMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  localState: MessageLocalStateHook;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageListPanel({
  messages, selectedId, onSelect, localState,
  selectedIds, onToggleSelect,
  currentPage, totalPages, totalCount,
}: ListPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("received_at");

  const sorted = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aPinned = localState.getState(a.id).isPinned ? 1 : 0;
      const bPinned = localState.getState(b.id).isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (sortKey === "received_at") {
        return b.received_at - a.received_at;
      }
      return (a.sender ?? "").localeCompare(b.sender ?? "", "ko");
    });
  }, [messages, sortKey, localState]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Select value={sortKey} onValueChange={(v: string) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="received_at">수신시간↓</SelectItem>
            <SelectItem value="sender">발신자</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.map((msg) => {
          const msgLocal = localState.getState(msg.id);
          const statusStep = localState.steps.find((s) => s.id === msgLocal.statusId);
          const isSelected = selectedId === msg.id;

          return (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2.5 border-b cursor-pointer transition-colors",
                "hover:bg-muted/50",
                isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
              )}
              onClick={() => onSelect(msg.id)}
            >
              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(msg.id)}
                  onCheckedChange={() => onToggleSelect(msg.id)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{msg.sender || "(발신자 없음)"}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                    {formatDate(msg.received_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.content}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {statusStep && (
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStep.color }} />
                      {statusStep.name}
                    </span>
                  )}
                  {msgLocal.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                    {SOURCE_LABEL[msg.source] || msg.app_name || msg.source}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">수신된 메시지가 없습니다.</p>
        )}
      </div>

      <div className="border-t px-2 py-1.5">
        <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} />
      </div>
    </div>
  );
}
