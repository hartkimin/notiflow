"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
  Trash2, Plus, Smartphone, Bot,
  Inbox, Cpu, PackageSearch, ClipboardList, ChevronRight, XCircle, Circle, X,
  CheckCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createMessage, deleteMessage, deleteMessages } from "@/lib/actions";
import { useRowSelection } from "@/hooks/use-row-selection";
import type { RawMessage } from "@/lib/types";

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

type SortKey = "id" | "sender" | "source_app" | "parse_status" | "received_at" | "device_name";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function truncate(s: string, max = 60) {
  return s.length > max ? s.slice(0, max) + "\u2026" : s;
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

// --- Parse Stepper ---

interface StepInfo {
  label: string;
  icon: React.ReactNode;
  status: "done" | "fail" | "pending" | "na";
  detail: string;
  sub: string;
}

function ParseStepper({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result as Record<string, unknown> | null;
  const items = Array.isArray(parseResult) ? parseResult : [];
  const hasParsed = msg.parse_status === "parsed";
  const hasFailed = msg.parse_status === "failed";

  let matched = 0, review = 0, unmatched = 0;
  for (const it of items) {
    const r = it as Record<string, unknown>;
    if (r.match_status === "matched") matched++;
    else if (r.match_status === "review") review++;
    else unmatched++;
  }

  const steps: StepInfo[] = [
    {
      label: "메시지 수신",
      icon: <Inbox className="h-4 w-4" />,
      status: "done",
      detail: formatDate(msg.received_at),
      sub: SOURCE_LABEL[msg.source_app] || msg.source_app,
    },
    {
      label: "AI 파싱",
      icon: <Cpu className="h-4 w-4" />,
      status: hasFailed ? "fail" : hasParsed ? "done" : "pending",
      detail: hasParsed
        ? msg.parse_method === "llm" ? "AI" : msg.parse_method === "regex" ? "정규식" : (msg.parse_method || "-")
        : hasFailed ? "실패" : "대기중",
      sub: hasParsed && items.length > 0 ? `${items.length}개 항목` : "",
    },
    {
      label: "제품 매칭",
      icon: <PackageSearch className="h-4 w-4" />,
      status: !hasParsed ? (hasFailed ? "fail" : "na") : items.length > 0 ? "done" : "na",
      detail: hasParsed && items.length > 0
        ? `매칭 ${matched}`
        : "-",
      sub: hasParsed && (review > 0 || unmatched > 0)
        ? `검토 ${review} / 미매칭 ${unmatched}`
        : "",
    },
    {
      label: "주문 생성",
      icon: <ClipboardList className="h-4 w-4" />,
      status: msg.order_id ? "done" : "na",
      detail: msg.order_id ? `#${msg.order_id}` : "-",
      sub: "",
    },
  ];

  const statusColor: Record<string, string> = {
    done: "text-green-600 bg-green-50 border-green-200",
    fail: "text-red-600 bg-red-50 border-red-200",
    pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
    na: "text-muted-foreground bg-muted/30 border-muted",
  };

  const statusIcon: Record<string, React.ReactNode> = {
    done: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
    fail: <XCircle className="h-3.5 w-3.5 text-red-600" />,
    pending: <Circle className="h-3.5 w-3.5 text-yellow-500" />,
    na: <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />,
  };

  return (
    <div className="flex items-start gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-start">
          <div className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 min-w-[120px] ${statusColor[step.status]}`}>
            <div className="flex items-center gap-1.5">
              {statusIcon[step.status]}
              <span className="text-xs font-medium">{step.label}</span>
            </div>
            <div className="flex items-center gap-1">
              {step.icon}
              <span className="text-xs">{step.detail}</span>
            </div>
            {step.sub && <span className="text-[10px] opacity-70">{step.sub}</span>}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-4 mx-0.5 shrink-0" />
          )}
        </div>
      ))}
    </div>
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

export function MessageTable({ messages }: { messages: RawMessage[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("received_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const sorted = useMemo(() => {
    return [...messages].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [messages, sortKey, sortDir]);

  return (
    <>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">수신된 메시지가 없습니다.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] px-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={rowSelection.allSelected ? true : rowSelection.someSelected ? "indeterminate" : false}
                    onCheckedChange={() => rowSelection.toggleAll()}
                  />
                </TableHead>
                <TableHead className="w-[50px] cursor-pointer select-none" onClick={() => toggleSort("id")}>
                  <span className="inline-flex items-center">ID<SortIcon active={sortKey === "id"} dir={sortDir} /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("sender")}>
                  <span className="inline-flex items-center">발신자<SortIcon active={sortKey === "sender"} dir={sortDir} /></span>
                </TableHead>
                <TableHead className="max-w-[250px]">내용</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("source_app")}>
                  <span className="inline-flex items-center">출처<SortIcon active={sortKey === "source_app"} dir={sortDir} /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("device_name")}>
                  <span className="inline-flex items-center">기기명<SortIcon active={sortKey === "device_name"} dir={sortDir} /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("parse_status")}>
                  <span className="inline-flex items-center">상태<SortIcon active={sortKey === "parse_status"} dir={sortDir} /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("received_at")}>
                  <span className="inline-flex items-center">수신시간<SortIcon active={sortKey === "received_at"} dir={sortDir} /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((msg) => (
                <React.Fragment key={msg.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
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
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{msg.sender || "-"}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                      {truncate(msg.content)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{SOURCE_LABEL[msg.source_app] || msg.source_app}</Badge>
                    </TableCell>
                    <TableCell>
                      {msg.device_name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Smartphone className="h-3 w-3" />
                          {msg.device_name}
                        </span>
                      ) : msg.device_id?.startsWith("cap:") ? (
                        <span className="text-xs text-muted-foreground">모바일</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[msg.parse_status] || "secondary"}>
                        {STATUS_LABEL[msg.parse_status] || msg.parse_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(msg.received_at)}</TableCell>
                  </TableRow>
                  {expandedId === msg.id && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={8} className="p-4">
                        <div className="space-y-3">
                          {/* Accordion content will be filled in Tasks 4-8 */}
                          <div className="rounded-md border bg-muted/30 p-3">
                            <pre className="text-sm whitespace-pre-wrap font-sans">{msg.content}</pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk action bar */}
      {rowSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{rowSelection.count}개 선택됨</span>
          <Button size="sm" disabled title="AI 파싱은 추후 지원 예정입니다">
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
