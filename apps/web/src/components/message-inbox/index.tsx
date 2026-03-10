"use client";

import { useState, useMemo, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MessageListPanel } from "./list-panel";
import { MessageDetailPanel } from "./detail-panel";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { deleteMessages } from "@/lib/actions";
import { requestSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import type { CapturedMessage } from "@/lib/types";

interface MessageInboxProps {
  messages: CapturedMessage[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageInbox({
  messages, currentPage, totalPages, totalCount,
}: MessageInboxProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const localState = useMessageLocalState();

  // String-based row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectionCount = useMemo(
    () => messages.filter((m) => selectedIds.has(m.id)).length,
    [messages, selectedIds],
  );

  const selectedMsg = messages.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    requestSidebarCollapse();
  }, []);

  return (
    <div className="flex flex-col">
      {/* 2-panel layout: list + detail */}
      <div className="grid grid-cols-[1fr_1fr] h-[calc(100vh-9rem)]">
        <div className="border rounded-l-lg overflow-hidden min-w-0">
          <MessageListPanel
            messages={messages}
            selectedId={selectedId}
            onSelect={setSelectedId}
            localState={localState}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
          />
        </div>
        <div className="border-y border-r rounded-r-lg overflow-hidden min-w-0">
          <MessageDetailPanel
            message={selectedMsg}
            localState={localState}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{selectionCount}개 선택됨</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={isPending}>
                <Trash2 className="h-4 w-4 mr-1" />삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{selectionCount}개 메시지를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteMessages(Array.from(selectedIds));
                        toast.success(`${selectionCount}개 메시지가 삭제되었습니다.`);
                        clearSelection();
                        router.refresh();
                      } catch (err) { toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`); }
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              const ids = Array.from(selectedIds).join(",");
              router.push(`/orders?source_messages=${encodeURIComponent(ids)}`);
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />주문 생성
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
