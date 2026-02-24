"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowUp, ArrowDown, ArrowUpDown,
  Trash2, Plus, Bot,
  Cpu, ClipboardList, ChevronRight, X,
  Pin, PinOff, Copy, Pencil, MessageSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createMessage, deleteMessage, deleteMessages, reparseMessage, reparseMessages } from "@/lib/actions";
import { ManualParseForm } from "@/components/manual-parse-form";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import type { RawMessage, Hospital, Product } from "@/lib/types";

const MSG_COL_DEFAULTS: Record<string, number> = {
  checkbox: 40, id: 50, sender: 120, source: 80, status: 80, order: 70, time: 140,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  parsed: "default",
  pending: "secondary",
  failed: "destructive",
  skipped: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  parsed: "파싱완료",
  pending: "대기",
  failed: "실패",
  skipped: "건너뜀",
};

const SOURCE_LABEL: Record<string, string> = {
  kakaotalk: "카카오톡",
  sms: "SMS",
  telegram: "텔레그램",
  manual: "수동",
};

type SortKey = "id" | "sender" | "source_app" | "parse_status" | "received_at";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// --- Filters ---

export function MessageFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const parse_status = fd.get("parse_status") as string;
    const source_app = fd.get("source_app") as string;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (parse_status && parse_status !== "all") params.set("parse_status", parse_status);
    if (source_app && source_app !== "all") params.set("source_app", source_app);
    router.push(`/messages?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-xs text-muted-foreground">시작일</label>
        <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="w-40" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">종료일</label>
        <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="w-40" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">상태</label>
        <Select name="parse_status" defaultValue={searchParams.get("parse_status") || "all"}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="parsed">파싱완료</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
            <SelectItem value="skipped">건너뜀</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">출처</label>
        <Select name="source_app" defaultValue={searchParams.get("source_app") || "all"}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="kakaotalk">카카오톡</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="telegram">텔레그램</SelectItem>
            <SelectItem value="manual">수동</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm">검색</Button>
    </form>
  );
}

// --- Create Message Dialog ---

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

// --- Parse Result Table ---

function ParseResultTable({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result;
  const items = Array.isArray(parseResult) ? parseResult : [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {msg.parse_status === "parsed" ? "파싱 결과가 없습니다." : "아직 파싱되지 않았습니다."}
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-medium">원문</th>
            <th className="text-left p-2 font-medium">매칭 제품</th>
            <th className="text-center p-2 font-medium">수량</th>
            <th className="text-center p-2 font-medium">단위</th>
            <th className="text-center p-2 font-medium">신뢰도</th>
          </tr>
        </thead>
        <tbody>
          {items.map((raw, i) => {
            const it = raw as Record<string, unknown>;
            const conf = Number(it.confidence ?? 0);
            const status = String(it.match_status ?? "unmatched");
            return (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2 text-xs font-mono">{String(it.item ?? "")}</td>
                <td className="p-2 text-sm">
                  {it.product_name ? String(it.product_name) : (
                    <span className="text-muted-foreground italic">미매칭</span>
                  )}
                </td>
                <td className="p-2 text-center font-mono">{String(it.qty ?? "")}</td>
                <td className="p-2 text-center text-xs">{String(it.unit ?? "")}</td>
                <td className="p-2 text-center">
                  <Badge
                    variant={status === "matched" ? "default" : status === "review" ? "secondary" : "outline"}
                    className={
                      status === "matched" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                      status === "review" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                      "bg-red-50 text-red-700"
                    }
                  >
                    {status === "matched" ? "매칭" : status === "review" ? "검토" : "미매칭"}
                    {conf > 0 && ` ${Math.round(conf * 100)}%`}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Message Table ---

export function MessageTable({ messages, hospitals, products }: {
  messages: RawMessage[];
  hospitals?: Hospital[];
  products?: Product[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("received_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [aiTestResult, setAiTestResult] = useState<Record<number, {
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
  } | null>>({});
  const [aiTestLoading, setAiTestLoading] = useState<number | null>(null);

  const localState = useMessageLocalState();

  const { widths, onMouseDown } = useResizableColumns("messages", MSG_COL_DEFAULTS);

  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteMessage(id);
        toast.success("메시지가 삭제되었습니다.");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "삭제 실패";
        toast.error(msg);
      }
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleExpandToggle(msgId: number) {
    const next = expandedId === msgId ? null : msgId;
    setExpandedId(next);
    // Reset drafts when collapsing
    if (next === null) {
      setCommentDraft("");
      setEditingMsgId(null);
      setEditDraft("");
    }
  }

  function handleStartEdit(msgId: number, originalContent: string) {
    const state = localState.getState(msgId);
    setEditingMsgId(msgId);
    setEditDraft(state.editedContent ?? originalContent);
  }

  function handleSaveEdit(msgId: number, originalContent: string) {
    const trimmed = editDraft.trim();
    // Store null if content matches original (revert edit)
    const content = trimmed === originalContent.trim() ? null : trimmed;
    localState.setEditedContent(msgId, content);
    setEditingMsgId(null);
    setEditDraft("");
    toast.success("메모가 저장되었습니다.");
  }

  function handleCancelEdit() {
    setEditingMsgId(null);
    setEditDraft("");
  }

  function handleAddComment(msgId: number) {
    const text = commentDraft.trim();
    if (!text) return;
    localState.addComment(msgId, text);
    setCommentDraft("");
  }

  function handleCopyContent(msgId: number, originalContent: string) {
    const state = localState.getState(msgId);
    const content = state.editedContent ?? originalContent;
    navigator.clipboard.writeText(content);
    toast.success("클립보드에 복사되었습니다.");
  }

  const sorted = useMemo(() => {
    return [...messages].sort((a, b) => {
      // Pinned messages always sort to top
      const aPinned = localState.getState(a.id).isPinned ? 1 : 0;
      const bPinned = localState.getState(b.id).isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [messages, sortKey, sortDir, localState]);

  return (
    <>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">수신된 메시지가 없습니다.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table style={{ tableLayout: "fixed" }}>
            <TableHeader>
              <TableRow>
                <ResizableTh width={widths.checkbox} colKey="checkbox" onResizeStart={onMouseDown} className="px-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={rowSelection.allSelected ? true : rowSelection.someSelected ? "indeterminate" : false}
                    onCheckedChange={() => rowSelection.toggleAll()}
                  />
                </ResizableTh>
                <ResizableTh width={widths.id} colKey="id" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("id")}>
                  <span className="inline-flex items-center">ID<SortIcon active={sortKey === "id"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.sender} colKey="sender" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("sender")}>
                  <span className="inline-flex items-center">발신자<SortIcon active={sortKey === "sender"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.source} colKey="source" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("source_app")}>
                  <span className="inline-flex items-center">출처<SortIcon active={sortKey === "source_app"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.status} colKey="status" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("parse_status")}>
                  <span className="inline-flex items-center">상태<SortIcon active={sortKey === "parse_status"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.order} colKey="order" onResizeStart={onMouseDown}>주문</ResizableTh>
                <ResizableTh width={widths.time} colKey="time" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("received_at")}>
                  <span className="inline-flex items-center">수신시간<SortIcon active={sortKey === "received_at"} dir={sortDir} /></span>
                </ResizableTh>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((msg) => {
                const msgLocal = localState.getState(msg.id);
                const statusStep = localState.steps.find((s) => s.id === msgLocal.statusId);
                const displayContent = msgLocal.editedContent ?? msg.content;

                return (
                  <React.Fragment key={msg.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleExpandToggle(msg.id)}
                    >
                      <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={rowSelection.selected.has(msg.id)}
                          onCheckedChange={() => rowSelection.toggle(msg.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="inline-flex items-center gap-1">
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedId === msg.id ? "rotate-90" : ""}`} />
                          {msg.id}
                          {msgLocal.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{msg.sender || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{SOURCE_LABEL[msg.source_app] || msg.source_app}</Badge>
                      </TableCell>
                      <TableCell>
                        {statusStep ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: statusStep.color,
                              color: statusStep.color,
                              backgroundColor: statusStep.color + "15",
                            }}
                          >
                            {statusStep.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">미지정</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {msg.order_id ? (
                          <Link
                            href={`/orders/${msg.order_id}`}
                            className="text-sm font-mono font-medium text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            #{msg.order_id}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(msg.received_at)}</TableCell>
                    </TableRow>

                    {expandedId === msg.id && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="px-3 py-2">
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            {/* 2-col: Message | Parse+AI */}
                            <div className="grid grid-cols-2 gap-3">
                            {/* Left: Message content */}
                            <div className="min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">메시지 내용 {msgLocal.editedContent !== null && <span className="text-orange-500">(편집됨)</span>}</span>
                                {editingMsgId !== msg.id && (
                                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => handleStartEdit(msg.id, msg.content)}>
                                    <Pencil className="h-3 w-3 mr-1" />편집
                                  </Button>
                                )}
                              </div>
                              {editingMsgId === msg.id ? (
                                <div className="space-y-1.5 mt-1">
                                  <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} className="text-sm font-sans" />
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="outline" size="sm" className="h-7" onClick={handleCancelEdit}>취소</Button>
                                    <Button size="sm" className="h-7" onClick={() => handleSaveEdit(msg.id, msg.content)}>저장</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-md border bg-muted/30 px-2 py-1.5 mt-1">
                                  <pre className="text-sm whitespace-pre-wrap font-sans leading-snug">{displayContent}</pre>
                                </div>
                              )}
                            </div>

                            {/* Right: Parse result + AI test */}
                            <div className="min-w-0 space-y-2">
                              <ParseResultTable msg={msg} />
                              {aiTestResult[msg.id] != null && (
                                <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      {aiTestResult[msg.id]!.ai_provider}/{aiTestResult[msg.id]!.ai_model}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {aiTestResult[msg.id]!.method === "llm" ? "AI" : "정규식"} · {aiTestResult[msg.id]!.latency_ms}ms
                                    </Badge>
                                    <div className="ml-auto flex gap-1">
                                      <Badge variant="default" className="text-[10px] px-1.5 py-0">{aiTestResult[msg.id]!.match_summary.matched} 매칭</Badge>
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{aiTestResult[msg.id]!.match_summary.review} 검토</Badge>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{aiTestResult[msg.id]!.match_summary.unmatched} 미매칭</Badge>
                                    </div>
                                  </div>
                                  {aiTestResult[msg.id]!.items.length > 0 && (
                                    <table className="w-full text-xs">
                                      <thead><tr className="border-b bg-muted/50">
                                        <th className="text-left p-1 font-medium">원문</th>
                                        <th className="text-left p-1 font-medium">매칭</th>
                                        <th className="text-center p-1 font-medium">수량</th>
                                        <th className="text-center p-1 font-medium">신뢰도</th>
                                      </tr></thead>
                                      <tbody>
                                        {aiTestResult[msg.id]!.items.map((item, i) => (
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
                              )}
                            </div>
                            </div>{/* /grid */}

                            {/* Order creation form */}
                            {!msg.order_id && hospitals && products && (
                              <ManualParseForm messageId={msg.id} hospitals={hospitals} products={products} onSuccess={() => router.refresh()} />
                            )}

                            {/* Merged info + actions bar */}
                            <div className="flex items-center gap-2 rounded-md border bg-muted/10 px-2 py-1">
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
                              <div className="ml-auto flex items-center gap-0.5">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                  disabled={aiTestLoading === msg.id || isPending}
                                  onClick={async () => {
                                    setAiTestLoading(msg.id);
                                    try {
                                      const res = await fetch("/api/test-parse", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ content: msg.content, hospitalId: msg.hospital_id ?? undefined, sender: msg.sender ?? undefined }),
                                      });
                                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                      const result = await res.json();
                                      setAiTestResult((prev) => ({ ...prev, [msg.id]: result }));
                                      toast.success(`AI 테스트 완료 (${result.method}) — ${result.items.length}개 품목 감지`);
                                    } catch { toast.error("AI 테스트에 실패했습니다."); }
                                    finally { setAiTestLoading(null); }
                                  }}
                                >
                                  <Bot className="h-3 w-3 mr-1" />{aiTestLoading === msg.id ? "테스트..." : "AI"}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={isPending}
                                  onClick={() => { startTransition(async () => {
                                    try { await reparseMessage(msg.id, msg.hospital_id ?? undefined); toast.success("파싱 완료"); router.refresh(); }
                                    catch { toast.error("파싱 실패"); }
                                  }); }}
                                >
                                  <Cpu className="h-3 w-3 mr-1" />파싱
                                </Button>
                                <span className="text-muted-foreground/30 mx-0.5">|</span>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => localState.togglePin(msg.id)} title={msgLocal.isPinned ? "핀 해제" : "핀 고정"}>
                                  {msgLocal.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopyContent(msg.id, msg.content)} title="복사">
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
                                      <AlertDialogAction onClick={() => handleDelete(msg.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>

                            {/* Comments (inline) */}
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[10px] text-muted-foreground shrink-0">({msgLocal.comments.length})</span>
                              <Input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(msg.id); } }}
                                placeholder="코멘트..." className="text-xs h-7 flex-1" />
                              <Button size="sm" variant="secondary" className="h-7 text-xs px-2"
                                onClick={() => handleAddComment(msg.id)} disabled={!commentDraft.trim()}>추가</Button>
                            </div>
                            {msgLocal.comments.length > 0 && (
                              <div className="space-y-1 max-h-24 overflow-y-auto">
                                {msgLocal.comments.map((comment) => (
                                  <div key={comment.id} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                                    <p className="text-xs break-words min-w-0 flex-1">{comment.text}</p>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(comment.createdAt)}</span>
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => localState.deleteComment(msg.id, comment.id)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk action bar */}
      {rowSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{rowSelection.count}개 선택됨</span>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const result = await reparseMessages(Array.from(rowSelection.selected));
                  const successCount = result.results.filter((r) => r.data && !r.error).length;
                  const failCount = result.results.filter((r) => r.error).length;
                  toast.success(`일괄 파싱 완료: ${successCount}개 성공${failCount > 0 ? `, ${failCount}개 실패` : ""}`);
                  rowSelection.clear();
                  router.refresh();
                } catch {
                  toast.error("일괄 파싱에 실패했습니다.");
                }
              });
            }}
          >
            <Bot className="h-4 w-4 mr-1" />
            일괄 파싱
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
                      } catch (err) {
                        toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={rowSelection.clear} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
