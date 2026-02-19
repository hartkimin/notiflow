"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onDelete: () => Promise<unknown>;
  label?: string;
}

export function BulkActionBar({ count, onClear, onDelete, label = "항목" }: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (count === 0) return null;

  function handleDelete() {
    startTransition(async () => {
      try {
        await onDelete();
        toast.success(`${count}개 ${label}이(가) 삭제되었습니다.`);
        onClear();
        router.refresh();
      } catch (err) {
        toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
      <span className="text-sm font-medium whitespace-nowrap">{count}개 선택됨</span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={isPending}>
            <Trash2 className="h-4 w-4 mr-1" />
            {isPending ? "삭제중..." : "삭제"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{count}개 {label}을(를) 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 선택한 {count}개 {label}이(가) 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button size="sm" variant="ghost" onClick={onClear} className="h-8 w-8 p-0">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
