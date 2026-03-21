"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2, Pin, PinOff, Copy, Pencil, MessageSquare, X,
} from "lucide-react";
import { deleteMessage } from "@/lib/actions";
import { SOURCE_LABEL, formatDateTime } from "./constants";
import type { UnifiedMessage } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

interface AccordionDetailProps {
  message: UnifiedMessage;
  localState: MessageLocalStateHook;
}

export function AccordionDetail({ message, localState }: AccordionDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const msg = message;
  const msgLocal = localState.getState(msg.id);
  const displayContent = msgLocal.editedContent ?? msg.content;

  function handleStartEdit() {
    const state = localState.getState(msg.id);
    setIsEditing(true);
    setEditDraft(state.editedContent ?? msg.content);
  }

  function handleSaveEdit() {
    const trimmed = editDraft.trim();
    const content = trimmed === msg.content.trim() ? null : trimmed;
    localState.setEditedContent(msg.id, content);
    setIsEditing(false);
    setEditDraft("");
    toast.success("메모가 저장되었습니다.");
  }

  function handleCancelEdit() {
    setIsEditing(false);
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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header: meta + actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap min-w-0">
          <span className="font-medium text-foreground">{msg.sender || "(발신자 없음)"}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{SOURCE_LABEL[msg.source_app] || msg.source_app}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{formatDateTime(msg.received_at)}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => localState.togglePin(msg.id)}
            title={msgLocal.isPinned ? "핀 해제" : "핀 고정"}
          >
            {msgLocal.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopyContent} title="복사">
            <Copy className="h-3.5 w-3.5" />
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

      {/* Sub meta */}
      {(msg.room_name || msg.device_name) && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b text-[10px] text-muted-foreground shrink-0">
          {msg.room_name && <span>채팅방: {msg.room_name}</span>}
          {msg.room_name && msg.device_name && <span className="text-muted-foreground/30">·</span>}
          {msg.device_name && <span>기기: {msg.device_name}</span>}
        </div>
      )}

      {/* Message content */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              메시지 내용 {msgLocal.editedContent !== null && <span className="text-orange-500">(편집됨)</span>}
            </span>
            {!isEditing && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleStartEdit}>
                <Pencil className="h-3 w-3 mr-1" />편집
              </Button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-1.5">
              <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={6} className="text-sm font-sans" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="h-7" onClick={handleCancelEdit}>취소</Button>
                <Button size="sm" className="h-7" onClick={handleSaveEdit}>저장</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/40 p-3 border">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-snug">{displayContent}</pre>
            </div>
          )}
        </div>

        {/* Comments */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
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
            <div className="space-y-1 max-h-40 overflow-y-auto">
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
    </div>
  );
}
