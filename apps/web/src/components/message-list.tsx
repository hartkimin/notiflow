"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { createMessage } from "@/lib/actions";

export function CreateMessageDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const source_app = fd.get("source_app") as string;
    const sender = fd.get("sender") as string;
    const content = fd.get("content") as string;

    if (!content.trim()) {
      toast.error("메시지 내용을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        await createMessage({
          source_app: source_app || "manual",
          sender: sender || undefined,
          content: content.trim(),
        });
        toast.success("메시지가 등록되었습니다.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "등록 실패";
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          메시지 등록
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>수동 메시지 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>출처</Label>
              <Select name="source_app" defaultValue="manual">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">수동</SelectItem>
                  <SelectItem value="kakaotalk">카카오톡</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="telegram">텔레그램</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>발신자</Label>
              <Input name="sender" placeholder="발신자명" />
            </div>
          </div>
          <div>
            <Label>메시지 내용</Label>
            <Textarea
              name="content"
              placeholder="메시지 내용을 입력하세요..."
              rows={5}
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">취소</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "등록중..." : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
