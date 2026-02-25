"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import { MessageListPanel } from "./list-panel";
import { MessageDetailPanel } from "./detail-panel";
import { OrderPanel } from "./order-panel";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { useRowSelection } from "@/hooks/use-row-selection";
import { reparseMessages, deleteMessages } from "@/lib/actions";
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

  return (
    <div className="flex flex-col">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-[calc(100vh-13rem)] rounded-lg border overflow-hidden"
      >
        <ResizablePanel defaultSize={50} minSize={20}>
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
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={20} minSize={15}>
          <MessageDetailPanel
            message={selectedMsg}
            localState={localState}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={15}>
          <OrderPanel
            message={selectedMsg}
            hospitals={hospitals}
            products={products}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bulk action bar */}
      {rowSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{rowSelection.count}개 선택됨</span>
          <Button size="sm" disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const result = await reparseMessages(Array.from(rowSelection.selected));
                  const successCount = result.results.filter((r) => r.data && !r.error).length;
                  const failCount = result.results.filter((r) => r.error).length;
                  toast.success(`일괄 파싱 완료: ${successCount}개 성공${failCount > 0 ? `, ${failCount}개 실패` : ""}`);
                  rowSelection.clear();
                  router.refresh();
                } catch { toast.error("일괄 파싱에 실패했습니다."); }
              });
            }}
          >
            <Bot className="h-4 w-4 mr-1" />일괄 파싱
          </Button>
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
