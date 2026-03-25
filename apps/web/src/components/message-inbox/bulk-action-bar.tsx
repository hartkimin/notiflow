"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteMessages } from "@/lib/actions";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

type StringRowSelection = RowSelectionHook<string>;

interface BulkActionBarProps {
  rowSelection: StringRowSelection;
}

export function BulkActionBar({ rowSelection }: BulkActionBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rowSelection.count === 0) return null;

  function handleCreateOrder() {
    const ids = Array.from(rowSelection.selected).join(",");
    router.push(`/orders/new?source_message_ids=${ids}`);
  }

  function handleBulkDelete() {
    startTransition(async () => {
      try {
        await deleteMessages(Array.from(rowSelection.selected));
        toast.success(`${rowSelection.count}개 메시지가 삭제되었습니다.`);
        rowSelection.clear();
        router.refresh();
      } catch (err) {
        toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-5 py-3 shadow-lg shadow-slate-200/50">
      <span className="text-sm font-semibold text-indigo-700 whitespace-nowrap">{rowSelection.count}개 선택됨</span>

      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-200 shadow-sm" onClick={handleCreateOrder} disabled={isPending}>
        <ShoppingCart className="h-4 w-4 mr-1" />주문 생성
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
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button size="sm" variant="ghost" onClick={rowSelection.clear} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
