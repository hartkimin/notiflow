"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2, Pin, PinOff, Copy, Pencil, MessageSquare, X, ShoppingCart,
} from "lucide-react";
import { deleteMessage } from "@/lib/actions";
import { SOURCE_LABEL, formatDateTime } from "./constants";
import type { CapturedMessage } from "@/lib/types";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

interface DetailPanelProps {
  message: CapturedMessage | null;
  localState: MessageLocalStateHook;
}

export function MessageDetailPanel({ message, localState }: DetailPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">메시지를 선택하세요</p>
        </div>
      </div>
    );
  }

  const msg = message;
  const msgLocal = localState.getState(msg.id);
  const displayContent = msgLocal.editedContent ?? msg.content;

  function handleStartEdit() {
    const state = localState.getState(msg.id);
    setEditingMsgId(msg.id);
    setEditDraft(state.editedContent ?? msg.content);
  }

  function handleSaveEdit() {
    const trimmed = editDraft.trim();
    const content = trimmed === msg.content.trim() ? null : trimmed;
    localState.setEditedContent(msg.id, content);
    setEditingMsgId(null);
    setEditDraft("");
    toast.success("메모가 저장되었습니다.");
  }

  function handleCancelEdit() {
    setEditingMsgId(null);
    setEditDraft("");
  }

  function handleAddComment() {
    const text = commentDraft.trim();
    if (!text) return;
    localState.addComment(msg.id, text);
    setCommentDraft("");
  }

  function handleCopyContent() {
    const state = localState.getState(msg.id);
    const content = state.editedContent ?? msg.content;
    navigator.clipboard.writeText(content);
    toast.success("클립보드에 복사되었습니다.");
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteMessage(msg.id);
        toast.success("메시지가 삭제되었습니다.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패");
      }
    });
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Meta bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <Select
          value={msgLocal.statusId ?? "none"}
          onValueChange={(val: string) => {
            if (val === "none") localState.clearStatus(msg.id);
            else localState.changeStatus(msg.id, val);
          }}
        >
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">미지정</SelectItem>
            {localState.steps.map((step) => (
              <SelectItem key={step.id} value={step.id}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: step.color }} />
                  {step.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground/30">|</span>
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABEL[msg.source] || msg.app_name || msg.source}
        </span>
        <span className="text-xs text-muted-foreground">{formatDateTime(msg.received_at)}</span>
        {msg.room_name && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-xs text-muted-foreground truncate">{msg.room_name}</span>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Message content */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              메시지 내용 {msgLocal.editedContent !== null && <span className="text-orange-500">(편집됨)</span>}
            </span>
            {editingMsgId !== msg.id && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleStartEdit}>
                <Pencil className="h-3 w-3 mr-1" />편집
              </Button>
            )}
          </div>
          {editingMsgId === msg.id ? (
            <div className="space-y-1.5">
              <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={4} className="text-sm font-sans" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="h-7" onClick={handleCancelEdit}>취소</Button>
                <Button size="sm" className="h-7" onClick={handleSaveEdit}>저장</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-snug">{displayContent}</pre>
            </div>
          )}
        </div>

        {/* Comments */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">코멘트 ({msgLocal.comments.length})</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); }
              }}
              placeholder="코멘트..."
              className="text-xs h-7 flex-1"
            />
            <Button size="sm" variant="secondary" className="h-7 text-xs px-2"
              onClick={handleAddComment} disabled={!commentDraft.trim()}>추가</Button>
          </div>
          {msgLocal.comments.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {msgLocal.comments.map((comment) => (
                <div key={comment.id} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                  <p className="text-xs break-words min-w-0 flex-1">{comment.text}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(comment.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => localState.deleteComment(msg.id, comment.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-t bg-background">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
          onClick={() => localState.togglePin(msg.id)}
          title={msgLocal.isPinned ? "핀 해제" : "핀 고정"}
        >
          {msgLocal.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopyContent} title="복사">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
          onClick={() => router.push(`/orders?create_from_message=${msg.id}`)}
          title="주문 생성">
          <ShoppingCart className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" disabled={isPending} title="삭제">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>메시지를 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
