"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MessageListPanel } from "./list-panel";
import { MessageDetailPanel } from "./detail-panel";
import { OrderPanel } from "./order-panel";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { useRowSelection } from "@/hooks/use-row-selection";
import { deleteMessages } from "@/lib/actions";
import { requestSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import type { RawMessage, Hospital, Product } from "@/lib/types";

interface MessageInboxProps {
  messages: RawMessage[];
  hospitals: Hospital[];
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageInbox({
  messages, hospitals, products, currentPage, totalPages, totalCount,
}: MessageInboxProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const localState = useMessageLocalState();
  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);

  const selectedMsg = messages.find((m) => m.id === selectedId) ?? null;

  // Auto-collapse sidebar to give 3-panel layout more horizontal space
  useEffect(() => {
    requestSidebarCollapse();
  }, []);

  return (
    <div className="flex flex-col">
      {/* 3:3:3:1(여백) fixed grid — sidebar 크기에 무관하게 동일 비율 */}
      <div className="grid grid-cols-[3fr_3fr_3fr_1fr] h-[calc(100vh-9rem)]">
        <div className="border rounded-l-lg overflow-hidden min-w-0">
          <MessageListPanel
            messages={messages}
            selectedId={selectedId}
            onSelect={setSelectedId}
            localState={localState}
            rowSelection={rowSelection}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
          />
        </div>
        <div className="border-y border-r overflow-hidden min-w-0">
          <MessageDetailPanel
            message={selectedMsg}
            localState={localState}
          />
        </div>
        <div className="border-y border-r rounded-r-lg overflow-hidden min-w-0">
          <OrderPanel
            message={selectedMsg}
            hospitals={hospitals}
            products={products}
          />
        </div>
        {/* 1fr 여백 */}
      </div>

      {/* Bulk action bar */}
      {rowSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{rowSelection.count}개 선택됨</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={isPending}>
                <Trash2 className="h-4 w-4 mr-1" />삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{rowSelection.count}개 메시지를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteMessages(Array.from(rowSelection.selected));
                        toast.success(`${rowSelection.count}개 메시지가 삭제되었습니다.`);
                        rowSelection.clear();
                        router.refresh();
                      } catch (err) { toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`); }
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={rowSelection.clear} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
