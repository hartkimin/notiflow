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
  Trash2, Pin, PinOff, Copy, Pencil, MessageSquare, Sparkles, X, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { deleteMessage } from "@/lib/actions";
import { SOURCE_LABEL, formatDateTime } from "./constants";
import type { UnifiedMessage, LinkedOrder } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "임시", confirmed: "접수", delivered: "배송완료", invoiced: "정산완료", cancelled: "취소",
};

interface AccordionDetailProps {
  message: UnifiedMessage;
  localState: MessageLocalStateHook;
  linkedOrder?: LinkedOrder;
}

export function AccordionDetail({ message, localState, linkedOrder }: AccordionDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const [parseResult, setParseResult] = useState<{
    items: Array<{
      item: string; qty: number; unit: string;
      matched_product: string | null; product_id: number | null;
      product_name_matched: string | null; standard_code: string | null;
      manufacturer: string | null; match_level: number; match_confidence: number;
      product_source: string | null;
    }>;
    confidence: number;
    method: string;
    durationMs: number;
    order?: { orderId: number; orderNumber: string; matchedCount: number; itemCount: number };
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  async function handleAiParse(autoCreate = false) {
    setIsParsing(true);
    try {
      const res = await fetch("/api/parse-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, autoCreateOrder: autoCreate }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "파싱 실패");
        return;
      }
      const data = await res.json();
      setParseResult({ ...data.parse, order: data.order });
      if (data.order) {
        toast.success(`주문 ${data.order.orderNumber} 생성됨 (${data.order.matchedCount}/${data.order.itemCount} 매칭)`);
        router.refresh();
      } else {
        toast.success(`${data.parse.items.length}건 품목 추출 (${data.parse.method}, ${data.parse.durationMs}ms)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI 파싱 중 오류");
    } finally {
      setIsParsing(false);
    }
  }

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

        {/* Linked Order */}
        {linkedOrder && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-700">연결된 주문</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {ORDER_STATUS_LABEL[linkedOrder.status] || linkedOrder.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="font-medium text-foreground">{linkedOrder.order_number}</div>
                {linkedOrder.hospital_name && <div>{linkedOrder.hospital_name}</div>}
                <div>{linkedOrder.order_date}</div>
              </div>
              <Link href={`/orders/${linkedOrder.id}`}>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  주문 보기
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* AI Parse */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">AI 파싱</span>
          </div>
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAiParse(false)} disabled={isParsing}>
              <Sparkles className="h-3 w-3" />{isParsing ? "분석중..." : "파싱만"}
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleAiParse(true)} disabled={isParsing}>
              <Sparkles className="h-3 w-3" />{isParsing ? "분석중..." : "파싱+주문생성"}
            </Button>
          </div>
          {parseResult && (
            <div className="space-y-1.5 rounded border p-2 bg-muted/20">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{parseResult.method} · {parseResult.durationMs}ms · 신뢰도 {(parseResult.confidence * 100).toFixed(0)}%</span>
                {parseResult.order && (
                  <a href={`/orders/${parseResult.order.orderId}`} className="text-primary hover:underline">
                    {parseResult.order.orderNumber}
                  </a>
                )}
              </div>
              {parseResult.items.map((item, i) => (
                <div key={i} className="rounded bg-background px-2.5 py-1.5 border space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{item.item}</span>
                    <span className="text-muted-foreground font-medium">{item.qty} {item.unit}</span>
                  </div>
                  {item.product_name_matched ? (
                    <div className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <span>✓</span>
                      <span className="truncate">{item.product_name_matched}</span>
                      {item.manufacturer && <span className="text-muted-foreground">({item.manufacturer})</span>}
                    </div>
                  ) : (
                    <div className="text-[10px] text-orange-500">미매칭 — 식약처 DB에서 유사 품목을 찾지 못했습니다</div>
                  )}
                  {item.standard_code && (
                    <div className="text-[10px] text-muted-foreground">코드: {item.standard_code}</div>
                  )}
                </div>
              ))}
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
