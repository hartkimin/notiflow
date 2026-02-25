"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
  Bot, Cpu, ClipboardList, Trash2,
  Pin, PinOff, Copy, Pencil, MessageSquare, X,
} from "lucide-react";
import { deleteMessage, reparseMessage } from "@/lib/actions";
import { ParseResultTable } from "./parse-result-table";
import { SOURCE_LABEL, formatDateTime } from "./constants";
import type { RawMessage } from "@/lib/types";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

interface AiTestResult {
  method: string;
  ai_provider: string | null;
  ai_model: string | null;
  latency_ms: number;
  token_usage: { input_tokens: number; output_tokens: number } | null;
  warnings: string[];
  match_summary: { matched: number; review: number; unmatched: number };
  items: {
    original_text: string;
    product_official_name: string | null;
    quantity: number;
    unit: string;
    product_id: number | null;
    match_confidence: number;
    match_status: string;
    match_method: string;
  }[];
}

interface DetailPanelProps {
  message: RawMessage | null;
  localState: MessageLocalStateHook;
}

export function MessageDetailPanel({ message, localState }: DetailPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [aiTestResult, setAiTestResult] = useState<Record<number, AiTestResult | null>>({});
  const [aiTestLoading, setAiTestLoading] = useState<number | null>(null);

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center border-r">
        <div className="text-center space-y-2">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">메시지를 선택하세요</p>
        </div>
      </div>
    );
  }

  const msg = message;
  const msgLocal = localState.getState(msg.id);
  const statusStep = localState.steps.find((s) => s.id === msgLocal.statusId);
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

  async function handleAiTest() {
    setAiTestLoading(msg.id);
    try {
      const res = await fetch("/api/test-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: msg.content,
          hospitalId: msg.hospital_id ?? undefined,
          sender: msg.sender ?? undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? `HTTP ${res.status}`);
      setAiTestResult((prev) => ({ ...prev, [msg.id]: result }));
      toast.success(`AI 테스트 완료 (${result.method}) — ${result.items.length}개 품목 감지`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI 테스트에 실패했습니다.");
    } finally {
      setAiTestLoading(null);
    }
  }

  function handleReparse() {
    startTransition(async () => {
      try {
        await reparseMessage(msg.id, msg.hospital_id ?? undefined);
        toast.success("파싱 완료");
        router.refresh();
      } catch {
        toast.error("파싱 실패");
      }
    });
  }

  const testResult = aiTestResult[msg.id];

  return (
    <div className="flex-1 flex flex-col border-r min-w-0">
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
        {msg.order_id ? (
          <Link href={`/orders/${msg.order_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ClipboardList className="h-3 w-3" />#{msg.order_id}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">주문 없음</span>
        )}
        <span className="text-muted-foreground/30">|</span>
        <span className="text-xs text-muted-foreground">{SOURCE_LABEL[msg.source_app] || msg.source_app}</span>
        <span className="text-xs text-muted-foreground">{formatDateTime(msg.received_at)}</span>
        {msg.device_name && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-xs text-muted-foreground truncate">{msg.device_name}</span>
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

        {/* Parse result */}
        <div>
          <span className="text-xs font-medium text-muted-foreground mb-1 block">파싱 결과</span>
          <ParseResultTable msg={msg} />
        </div>

        {/* AI test result */}
        {testResult != null && (
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-1 block">AI 테스트 결과</span>
            <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {testResult.ai_provider}/{testResult.ai_model}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {testResult.method === "llm" ? "AI" : "정규식"} · {testResult.latency_ms}ms
                </Badge>
                <div className="ml-auto flex gap-1">
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">{testResult.match_summary.matched} 매칭</Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{testResult.match_summary.review} 검토</Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{testResult.match_summary.unmatched} 미매칭</Badge>
                </div>
              </div>
              {testResult.items.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-1 font-medium">원문</th>
                      <th className="text-left p-1 font-medium">매칭</th>
                      <th className="text-center p-1 font-medium">수량</th>
                      <th className="text-center p-1 font-medium">신뢰도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResult.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-1 text-muted-foreground">{item.original_text}</td>
                        <td className="p-1">{item.product_official_name ?? <span className="italic text-muted-foreground">-</span>}</td>
                        <td className="p-1 text-center">{item.quantity} {item.unit}</td>
                        <td className="p-1 text-center">
                          <Badge variant={item.match_confidence >= 0.8 ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                            {Math.round(item.match_confidence * 100)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

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
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
          disabled={aiTestLoading === msg.id || isPending}
          onClick={handleAiTest}
        >
          <Bot className="h-3 w-3 mr-1" />{aiTestLoading === msg.id ? "테스트..." : "AI 파싱"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={isPending}
          onClick={handleReparse}
        >
          <Cpu className="h-3 w-3 mr-1" />파싱 실행
        </Button>
        <span className="text-muted-foreground/30 mx-0.5">|</span>
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
  );
}
