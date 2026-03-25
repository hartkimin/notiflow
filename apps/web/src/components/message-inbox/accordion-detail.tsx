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
  Trash2, Pin, PinOff, Copy, Pencil, MessageSquare, Sparkles, X, ExternalLink, ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { deleteMessage } from "@/lib/actions";
import { SOURCE_LABEL, formatDateTime } from "./constants";
import type { UnifiedMessage, LinkedOrder } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

const ORDER_STATUS_LABEL: Record<string, string> = {
  confirmed: "미완료", delivered: "완료",
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
    hospitalId: number | null;
    hospitalName: string | null;
    order?: { orderId: number; orderNumber: string; matchedCount: number; itemCount: number };
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  async function handleAiParse() {
    setIsParsing(true);
    try {
      const res = await fetch("/api/parse-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, autoCreateOrder: false }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "파싱 실패");
        return;
      }
      const data = await res.json();
      setParseResult({ ...data.parse, hospitalId: data.hospitalId, hospitalName: data.hospitalName });
      toast.success(`${data.parse.items.length}건 품목 추출 (${data.parse.method}, ${data.parse.durationMs}ms)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI 파싱 중 오류");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleCreateOrder() {
    if (!parseResult || parseResult.items.length === 0) return;
    setIsCreatingOrder(true);
    try {
      const res = await fetch("/api/parse-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, autoCreateOrder: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "주문 생성 실패");
        return;
      }
      const data = await res.json();
      if (data.order) {
        setParseResult(prev => prev ? { ...prev, order: data.order } : null);
        toast.success(`주문 ${data.order.orderNumber} 생성됨 (${data.order.matchedCount}/${data.order.itemCount} 매칭)`);
        router.refresh();
      } else {
        toast.error("주문 생성에 실패했습니다. 거래처가 매칭되지 않았을 수 있습니다.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "주문 생성 중 오류");
    } finally {
      setIsCreatingOrder(false);
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gradient-to-r from-slate-50 to-sky-50/30 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap min-w-0">
          <span className="font-medium text-foreground">{msg.sender || "(발신자 없음)"}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{SOURCE_LABEL[msg.source_app] || msg.source_app}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{formatDateTime(msg.received_at)}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!linkedOrder && (
            <Link href={`/orders/new?source_message_id=${msg.id}`}>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-200" title="주문 생성">
                <ShoppingCart className="h-3.5 w-3.5 mr-0.5" />
                <span className="text-[10px] font-medium">주문</span>
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-amber-50 hover:text-amber-600 transition-all duration-200"
            onClick={() => localState.togglePin(msg.id)}
            title={msgLocal.isPinned ? "핀 해제" : "핀 고정"}
          >
            {msgLocal.isPinned ? <PinOff className="h-3.5 w-3.5 text-amber-500" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-sky-50 hover:text-sky-600 transition-all duration-200" onClick={handleCopyContent} title="복사">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200" disabled={isPending} title="삭제">
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
            <div className="rounded-lg bg-slate-50/60 p-3 border border-slate-100">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-snug text-slate-700">{displayContent}</pre>
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
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span className="text-xs font-medium text-violet-600">AI 파싱</span>
          </div>
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all duration-200" onClick={handleAiParse} disabled={isParsing || isCreatingOrder}>
              <Sparkles className="h-3 w-3" />{isParsing ? "분석중..." : "AI 파싱"}
            </Button>
          </div>

          {/* Parse Result Preview */}
          {parseResult && (
            <div className="space-y-1.5 rounded border p-2 bg-muted/20">
              {/* Header: method, time, confidence */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {parseResult.method} · {parseResult.durationMs}ms ·
                  <span className={`font-semibold px-1 py-0.5 rounded ${
                    parseResult.confidence >= 0.8 ? "text-green-700 bg-green-100" :
                    parseResult.confidence >= 0.6 ? "text-amber-700 bg-amber-100" :
                    "text-red-700 bg-red-100"
                  }`}>
                    신뢰도 {(parseResult.confidence * 100).toFixed(0)}%
                  </span>
                </span>
                {parseResult.order && (
                  <a href={`/orders/${parseResult.order.orderId}`} className="text-primary hover:underline font-medium">
                    {parseResult.order.orderNumber} →
                  </a>
                )}
              </div>

              {/* Hospital match info */}
              {parseResult.hospitalName ? (
                <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 rounded px-2 py-1">
                  <span>🏥</span>
                  <span className="font-medium">거래처: {parseResult.hospitalName}</span>
                </div>
              ) : (
                <div className="text-[10px] text-orange-500 bg-orange-50 rounded px-2 py-1">
                  ⚠ 거래처를 자동 추론하지 못했습니다. 주문 생성 시 수동 선택이 필요합니다.
                </div>
              )}

              {/* Item list */}
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
                    <div className="text-[10px] text-orange-500">미매칭</div>
                  )}
                  {item.standard_code && (
                    <div className="text-[10px] text-muted-foreground">코드: {item.standard_code}</div>
                  )}
                </div>
              ))}

              {/* Order creation actions */}
              {!parseResult.order && parseResult.items.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t mt-1">
                  {parseResult.hospitalName ? (
                    <Button size="sm" className="h-7 text-xs gap-1 flex-1" onClick={handleCreateOrder} disabled={isCreatingOrder}>
                      {isCreatingOrder ? "생성중..." : `주문 생성 (${parseResult.items.length}건)`}
                    </Button>
                  ) : (
                    <Link href={`/orders/new?source_message_id=${msg.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 w-full">
                        거래처 선택 후 주문 생성 →
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {/* Order created badge */}
              {parseResult.order && (
                <div className="flex items-center gap-2 pt-1 border-t mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1 flex-1">
                    <span>✅</span>
                    <span>주문 생성 완료 — {parseResult.order.orderNumber} ({parseResult.order.matchedCount}/{parseResult.order.itemCount} 매칭)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comments */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="h-3 w-3 text-teal-500" />
            <span className="text-xs font-medium text-teal-600">코멘트 ({msgLocal.comments.length})</span>
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
            <Button size="sm" variant="secondary" className="h-7 text-xs px-2 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-all duration-200"
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
