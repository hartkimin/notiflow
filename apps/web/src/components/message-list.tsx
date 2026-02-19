"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown,
  Trash2, Plus, Pencil, Smartphone, Bot, Loader2, CheckCircle, AlertTriangle,
  Inbox, Cpu, PackageSearch, ClipboardList, ChevronRight, XCircle, Circle, X,
  Check, ChevronsUpDown, Building2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createMessage, updateMessage, deleteMessage, deleteMessages, reparseMessage, reparseMessages, testParseMessage } from "@/lib/actions";
import { ManualParseForm } from "@/components/manual-parse-form";
import { useRowSelection } from "@/hooks/use-row-selection";
import type { RawMessage, Hospital, Product } from "@/lib/types";

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

type SortKey = "id" | "sender" | "source_app" | "parse_status" | "received_at" | "synced_at" | "device_name";
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

export function MessageTable({
  messages,
  hospitals = [],
  products = [],
}: {
  messages: RawMessage[];
  hospitals?: Hospital[];
  products?: Product[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("received_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<RawMessage | null>(null);

  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);

  function switchView(v: "list" | "grid") {
    setView(v);
    rowSelection.clear();
  }
  const [showManualParse, setShowManualParse] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Expanded row for parse visibility
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // AI parsing state (Sheet)
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);

  // Inline reparse state (expanded row)
  const [inlineAiResult, setInlineAiResult] = useState<Record<string, unknown> | null>(null);
  const [inlineAiError, setInlineAiError] = useState<string | null>(null);
  const [inlineAiParsing, setInlineAiParsing] = useState(false);

  // Hospital selection dialog for reparse
  const [reparseTarget, setReparseTarget] = useState<{ ids: number[]; mode: "single" | "bulk" } | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");

  // Edit form state
  const [editSender, setEditSender] = useState("");
  const [editSourceApp, setEditSourceApp] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editParseStatus, setEditParseStatus] = useState("");

  function openEdit(msg: RawMessage) {
    setEditSender(msg.sender || "");
    setEditSourceApp(msg.source_app);
    setEditContent(msg.content);
    setEditParseStatus(msg.parse_status);
    setIsEditing(true);
  }

  function handleUpdate() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await updateMessage(selected.id, {
          sender: editSender || null,
          source_app: editSourceApp,
          content: editContent,
          parse_status: editParseStatus,
        });
        toast.success("메시지가 수정되었습니다.");
        setIsEditing(false);
        setSelected(null);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "수정 실패";
        toast.error(msg);
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteMessage(id);
        toast.success("메시지가 삭제되었습니다.");
        setSelected(null);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "삭제 실패";
        toast.error(msg);
      }
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleAiParse(content: string, hospitalId?: number | null) {
    setIsAiParsing(true);
    setAiResult(null);
    setAiError(null);
    try {
      const data = await testParseMessage(content, hospitalId ?? undefined);
      setAiResult(data as Record<string, unknown>);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI 파싱 실패");
    } finally {
      setIsAiParsing(false);
    }
  }

  async function handleInlineReparse(content: string, hospitalId?: number | null) {
    setInlineAiParsing(true);
    setInlineAiResult(null);
    setInlineAiError(null);
    try {
      const data = await testParseMessage(content, hospitalId ?? undefined);
      setInlineAiResult(data as Record<string, unknown>);
    } catch (err) {
      setInlineAiError(err instanceof Error ? err.message : "AI 파싱 실패");
    } finally {
      setInlineAiParsing(false);
    }
  }

  function handleReparse(id: number, hospitalId?: number) {
    startTransition(async () => {
      try {
        const result = await reparseMessage(id, hospitalId);
        if (result.order_id) {
          toast.success(`파싱 완료 — 주문 #${result.order_id} 생성됨`);
        } else {
          toast.success(`파싱 완료 (${result.status})`);
        }
        router.refresh();
      } catch (err) {
        toast.error(`파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function triggerReparse(msg: RawMessage) {
    if (!msg.hospital_id) {
      setReparseTarget({ ids: [msg.id], mode: "single" });
      setSelectedHospitalId("");
    } else {
      handleReparse(msg.id);
    }
  }

  function triggerBulkReparse() {
    const ids = Array.from(rowSelection.selected);
    const hasNoHospital = ids.some((id) => {
      const msg = messages.find((m) => m.id === id);
      return msg && !msg.hospital_id;
    });
    if (hasNoHospital) {
      setReparseTarget({ ids, mode: "bulk" });
      setSelectedHospitalId("");
    } else {
      executeBulkReparse(ids);
    }
  }

  function confirmHospitalAndReparse() {
    if (!reparseTarget || !selectedHospitalId) return;
    const hid = Number(selectedHospitalId);
    if (reparseTarget.mode === "single") {
      handleReparse(reparseTarget.ids[0], hid);
    } else {
      executeBulkReparse(reparseTarget.ids, hid);
    }
    setReparseTarget(null);
    setSelectedHospitalId("");
  }

  function executeBulkReparse(ids: number[], hospitalId?: number) {
    startTransition(async () => {
      try {
        const { results } = await reparseMessages(ids, hospitalId);
        const ok = results.filter((r) => !r.error).length;
        const fail = results.filter((r) => r.error).length;
        toast.success(`${ok}개 파싱 완료${fail > 0 ? `, ${fail}개 실패` : ""}`);
        rowSelection.clear();
        router.refresh();
      } catch (err) {
        toast.error(`일괄 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
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
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          <Button variant={view === "list" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => switchView("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={view === "grid" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => switchView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">수신된 메시지가 없습니다.</p>
      ) : view === "list" ? (
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
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("synced_at")}>
                  <span className="inline-flex items-center">동기화<SortIcon active={sortKey === "synced_at"} dir={sortDir} /></span>
                </TableHead>
                <TableHead>주문</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((msg) => (
                <React.Fragment key={msg.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { const newId = expandedId === msg.id ? null : msg.id; setExpandedId(newId); if (newId !== expandedId) { setInlineAiResult(null); setInlineAiError(null); } }}
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
                    <TableCell className="text-sm whitespace-nowrap">{msg.synced_at ? formatDate(msg.synced_at) : "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {msg.order_id ? `#${msg.order_id}` : "-"}
                    </TableCell>
                  </TableRow>
                  {expandedId === msg.id && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={10} className="p-4">
                        <div className="space-y-3">
                          <ParseStepper msg={msg} />
                          <ParseResultTable msg={msg} />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(msg);
                                setIsEditing(false);
                                setShowManualParse(false);
                                setAiResult(null);
                                setAiError(null);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              상세
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={inlineAiParsing}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInlineReparse(msg.content, msg.hospital_id);
                              }}
                            >
                              {inlineAiParsing ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />파싱중</>
                              ) : (
                                <><Bot className="h-3.5 w-3.5 mr-1" />AI 테스트</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerReparse(msg);
                              }}
                            >
                              {isPending ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />실행중</>
                              ) : (
                                <><Bot className="h-3.5 w-3.5 mr-1" />파싱 실행</>
                              )}
                            </Button>
                          </div>
                          {inlineAiError && (
                            <div className="rounded-md bg-destructive/10 p-3 flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <p className="text-sm text-destructive">{inlineAiError}</p>
                            </div>
                          )}
                          {inlineAiResult && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium">재파싱 결과</span>
                                {inlineAiResult.ai_provider != null && (
                                  <Badge variant="secondary" className="text-xs">
                                    {String(inlineAiResult.ai_provider)}/{String(inlineAiResult.ai_model)}
                                  </Badge>
                                )}
                                {inlineAiResult.latency_ms != null && (
                                  <span className="text-xs text-muted-foreground">{String(inlineAiResult.latency_ms)}ms</span>
                                )}
                              </div>
                              {Array.isArray(inlineAiResult.items) && inlineAiResult.items.length > 0 && (
                                <div className="rounded-md border overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b bg-muted/50">
                                        <th className="text-left p-2 font-medium">원문</th>
                                        <th className="text-left p-2 font-medium">매칭 제품</th>
                                        <th className="text-center p-2 font-medium">수량</th>
                                        <th className="text-center p-2 font-medium">신뢰도</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(inlineAiResult.items as Array<Record<string, unknown>>).map((item, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                          <td className="p-2 text-xs font-mono">{String(item.original_text ?? item.product_name ?? "")}</td>
                                          <td className="p-2">{item.product_official_name ? String(item.product_official_name) : <span className="text-muted-foreground italic">미매칭</span>}</td>
                                          <td className="p-2 text-center font-mono">{String(item.quantity ?? "")}{item.unit ? ` ${item.unit}` : ""}</td>
                                          <td className="p-2 text-center">
                                            <Badge variant={item.match_status === "matched" ? "default" : item.match_status === "review" ? "secondary" : "outline"}>
                                              {item.match_status === "matched" ? "매칭" : item.match_status === "review" ? "검토" : "미매칭"}
                                            </Badge>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((msg) => (
            <div key={msg.id} className={expandedId === msg.id ? "sm:col-span-2 lg:col-span-3" : ""}>
              <Card
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => { const newId = expandedId === msg.id ? null : msg.id; setExpandedId(newId); if (newId !== expandedId) { setInlineAiResult(null); setInlineAiError(null); } }}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{msg.sender || "알 수 없음"}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{SOURCE_LABEL[msg.source_app] || msg.source_app}</Badge>
                      <Badge variant={STATUS_VARIANT[msg.parse_status] || "secondary"} className="text-xs">
                        {STATUS_LABEL[msg.parse_status] || msg.parse_status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span>수신: {formatDate(msg.received_at)}</span>
                      {msg.synced_at && <span>동기화: {formatDate(msg.synced_at)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.device_name && (
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          {msg.device_name}
                        </span>
                      )}
                      {msg.order_id && <span className="font-mono">주문 #{msg.order_id}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {expandedId === msg.id && (
                <div className="mt-2 rounded-lg border bg-muted/20 p-4 space-y-3">
                  <ParseStepper msg={msg} />
                  <ParseResultTable msg={msg} />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(msg);
                        setIsEditing(false);
                        setShowManualParse(false);
                        setAiResult(null);
                        setAiError(null);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      상세
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={inlineAiParsing}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInlineReparse(msg.content, msg.hospital_id);
                      }}
                    >
                      {inlineAiParsing ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />파싱중</>
                      ) : (
                        <><Bot className="h-3.5 w-3.5 mr-1" />AI 테스트</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerReparse(msg);
                      }}
                    >
                      {isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />실행중</>
                      ) : (
                        <><Bot className="h-3.5 w-3.5 mr-1" />파싱 실행</>
                      )}
                    </Button>
                  </div>
                  {inlineAiError && (
                    <div className="rounded-md bg-destructive/10 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{inlineAiError}</p>
                    </div>
                  )}
                  {inlineAiResult && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">재파싱 결과</span>
                        {inlineAiResult.ai_provider != null && (
                          <Badge variant="secondary" className="text-xs">
                            {String(inlineAiResult.ai_provider)}/{String(inlineAiResult.ai_model)}
                          </Badge>
                        )}
                        {inlineAiResult.latency_ms != null && (
                          <span className="text-xs text-muted-foreground">{String(inlineAiResult.latency_ms)}ms</span>
                        )}
                      </div>
                      {Array.isArray(inlineAiResult.items) && inlineAiResult.items.length > 0 && (
                        <div className="rounded-md border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-2 font-medium">원문</th>
                                <th className="text-left p-2 font-medium">매칭 제품</th>
                                <th className="text-center p-2 font-medium">수량</th>
                                <th className="text-center p-2 font-medium">신뢰도</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(inlineAiResult.items as Array<Record<string, unknown>>).map((item, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="p-2 text-xs font-mono">{String(item.original_text ?? item.product_name ?? "")}</td>
                                  <td className="p-2">{item.product_official_name ? String(item.product_official_name) : <span className="text-muted-foreground italic">미매칭</span>}</td>
                                  <td className="p-2 text-center font-mono">{String(item.quantity ?? "")}{item.unit ? ` ${item.unit}` : ""}</td>
                                  <td className="p-2 text-center">
                                    <Badge variant={item.match_status === "matched" ? "default" : item.match_status === "review" ? "secondary" : "outline"}>
                                      {item.match_status === "matched" ? "매칭" : item.match_status === "review" ? "검토" : "미매칭"}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rowSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{rowSelection.count}개 선택됨</span>
          <Button size="sm" disabled={isPending} onClick={triggerBulkReparse}>
            {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bot className="h-4 w-4 mr-1" />}
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

      {/* Hospital selection dialog for reparse */}
      <Dialog open={reparseTarget !== null} onOpenChange={(open: boolean) => { if (!open) { setReparseTarget(null); setSelectedHospitalId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>거래처 선택</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {reparseTarget?.mode === "single"
              ? "이 메시지에 연결된 거래처가 없습니다. 파싱 실행을 위해 거래처를 선택해주세요."
              : "선택한 메시지 중 거래처가 없는 메시지가 있습니다. 거래처를 선택해주세요."}
          </p>
          <Command className="rounded-md border">
            <CommandInput placeholder="거래처명 검색..." />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {hospitals.map((h) => (
                  <CommandItem
                    key={h.id}
                    value={`${h.name} ${h.short_name || ""}`}
                    onSelect={() => setSelectedHospitalId(String(h.id))}
                    className="cursor-pointer"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{h.name}</span>
                      {h.short_name && <span className="text-xs text-muted-foreground">{h.short_name}</span>}
                    </div>
                    {selectedHospitalId === String(h.id) && (
                      <Check className="h-4 w-4 ml-auto shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {selectedHospitalId && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">
                {hospitals.find((h) => String(h.id) === selectedHospitalId)?.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-auto shrink-0"
                onClick={() => setSelectedHospitalId("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">취소</Button>
            </DialogClose>
            <Button
              disabled={!selectedHospitalId || isPending}
              onClick={confirmHospitalAndReparse}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />실행중...</>
              ) : (
                "파싱 실행"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message detail / edit sheet */}
      <Sheet open={selected !== null} onOpenChange={(open: boolean) => { if (!open) { setSelected(null); setIsEditing(false); } }}>
        <SheetContent className="w-[480px] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditing ? "메시지 수정" : "메시지 상세"}</SheetTitle>
          </SheetHeader>
          {selected && !isEditing && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">ID</span>
                  <p className="font-mono">{selected.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">발신자</span>
                  <p className="font-medium">{selected.sender || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">출처</span>
                  <p><Badge variant="outline">{SOURCE_LABEL[selected.source_app] || selected.source_app}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">상태</span>
                  <p>
                    <Badge variant={STATUS_VARIANT[selected.parse_status] || "secondary"}>
                      {STATUS_LABEL[selected.parse_status] || selected.parse_status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">수신시간</span>
                  <p>{new Date(selected.received_at).toLocaleString("ko-KR")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">동기화 시간</span>
                  <p>{selected.synced_at ? new Date(selected.synced_at).toLocaleString("ko-KR") : "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">주문 ID</span>
                  <p className="font-mono">{selected.order_id ? `#${selected.order_id}` : "-"}</p>
                </div>
                {selected.hospital_id && (
                  <div>
                    <span className="text-muted-foreground">거래처 ID</span>
                    <p className="font-mono">#{selected.hospital_id}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">수신 기기</span>
                  <p className="text-sm">
                    {selected.device_name ? (
                      <span className="inline-flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5" />
                        {selected.device_name}
                      </span>
                    ) : selected.device_id?.startsWith("cap:") ? (
                      "모바일 앱 캡쳐"
                    ) : selected.device_id ? (
                      <span className="font-mono text-xs">{selected.device_id}</span>
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">메시지 내용</span>
                <div className="mt-1 rounded-md border bg-muted/30 p-3">
                  <pre className="text-sm whitespace-pre-wrap font-sans">{selected.content}</pre>
                </div>
              </div>

              {/* AI Parse buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={isAiParsing}
                  onClick={() => handleAiParse(selected.content, selected.hospital_id)}
                >
                  {isAiParsing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 분석중...</>
                  ) : (
                    <><Bot className="h-4 w-4 mr-2" /> AI 테스트</>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  disabled={isPending}
                  onClick={() => triggerReparse(selected)}
                >
                  {isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 실행중...</>
                  ) : (
                    <><Bot className="h-4 w-4 mr-2" /> 파싱 실행</>
                  )}
                </Button>
              </div>
              <div>

                {aiError && (
                  <div className="mt-2 rounded-md bg-destructive/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{aiError}</p>
                  </div>
                )}

                {aiResult && (
                  <div className="mt-3 space-y-3">
                    <Separator />
                    <div className="flex items-center gap-2 flex-wrap">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">파싱 결과</span>
                      {aiResult.ai_provider != null && (
                        <Badge variant="secondary" className="text-xs">
                          {String(aiResult.ai_provider)}/{String(aiResult.ai_model)}
                        </Badge>
                      )}
                      {aiResult.method === "regex" && (
                        <Badge variant="outline" className="text-xs">
                          정규식 (AI 미사용)
                        </Badge>
                      )}
                      {aiResult.match_summary != null && (
                        <div className="flex gap-1.5 ml-auto">
                          <Badge variant="default">{(aiResult.match_summary as Record<string, number>).matched ?? 0} 매칭</Badge>
                          <Badge variant="secondary">{(aiResult.match_summary as Record<string, number>).review ?? 0} 검토</Badge>
                          <Badge variant="outline">{(aiResult.match_summary as Record<string, number>).unmatched ?? 0} 미매칭</Badge>
                        </div>
                      )}
                    </div>

                    {Array.isArray(aiResult.items) && aiResult.items.length > 0 && (
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-2 font-medium">원문</th>
                              <th className="text-left p-2 font-medium">매칭 품목</th>
                              <th className="text-center p-2 font-medium">수량</th>
                              <th className="text-center p-2 font-medium">신뢰도</th>
                              <th className="text-center p-2 font-medium">상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(aiResult.items as Array<Record<string, unknown>>).map((item, i) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="p-2 text-xs text-muted-foreground max-w-[150px] truncate">
                                  {String(item.original_text ?? item.product_name ?? "")}
                                </td>
                                <td className="p-2">
                                  {item.product_official_name ? String(item.product_official_name) : (
                                    <span className="text-muted-foreground italic">미매칭</span>
                                  )}
                                </td>
                                <td className="p-2 text-center">
                                  {String(item.quantity ?? "")}{item.unit ? ` ${item.unit}` : ""}
                                </td>
                                <td className="p-2 text-center">
                                  {item.match_confidence != null && (
                                    <Badge
                                      variant={
                                        Number(item.match_confidence) >= 0.8 ? "default" :
                                        Number(item.match_confidence) >= 0.5 ? "secondary" : "outline"
                                      }
                                    >
                                      {Math.round(Number(item.match_confidence) * 100)}%
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-2 text-center">
                                  <Badge
                                    variant={
                                      item.match_status === "matched" ? "default" :
                                      item.match_status === "review" ? "secondary" : "outline"
                                    }
                                  >
                                    {item.match_status === "matched" ? "매칭" :
                                     item.match_status === "review" ? "검토" : "미매칭"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {aiResult.method != null && aiResult.latency_ms != null && (
                      <p className="text-xs text-muted-foreground">
                        파싱 방법: {String(aiResult.method)} | 소요시간: {String(aiResult.latency_ms)}ms
                        {aiResult.token_usage != null && (
                          <> | 토큰: {String((aiResult.token_usage as Record<string, number>).input_tokens)}→{String((aiResult.token_usage as Record<string, number>).output_tokens)}</>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selected.parse_result && (
                <div>
                  <span className="text-sm text-muted-foreground">파싱 결과</span>
                  <div className="mt-2">
                    <ParseResultTable msg={selected} />
                  </div>
                </div>
              )}

              {/* Edit button */}
              <div className="border-t pt-4">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => openEdit(selected)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  메시지 수정
                </Button>
              </div>

              {/* Manual parse button for failed/pending messages */}
              {(selected.parse_status === "failed" || selected.parse_status === "pending") && !selected.order_id && (
                <div>
                  {!showManualParse ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setShowManualParse(true)}
                    >
                      수동 파싱으로 주문 생성
                    </Button>
                  ) : (
                    <ManualParseForm
                      messageId={selected.id}
                      hospitals={hospitals}
                      products={products}
                      onSuccess={() => {
                        setShowManualParse(false);
                        setSelected(null);
                      }}
                    />
                  )}
                </div>
              )}

              {/* Delete button */}
              <div className="border-t pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      메시지 삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>메시지를 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 작업은 되돌릴 수 없습니다. 메시지가 데이터베이스에서 영구적으로 삭제됩니다.
                        {selected.order_id && (
                          <span className="block mt-2 font-medium text-destructive">
                            주의: 이 메시지는 주문 #{selected.order_id}과 연결되어 있습니다.
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(selected.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {/* Edit mode */}
          {selected && isEditing && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>출처</Label>
                  <Select value={editSourceApp} onValueChange={setEditSourceApp}>
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
                  <Label>상태</Label>
                  <Select value={editParseStatus} onValueChange={setEditParseStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="parsed">파싱완료</SelectItem>
                      <SelectItem value="failed">실패</SelectItem>
                      <SelectItem value="skipped">건너뜀</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>발신자</Label>
                <Input
                  value={editSender}
                  onChange={(e) => setEditSender(e.target.value)}
                  placeholder="발신자명"
                />
              </div>
              <div>
                <Label>메시지 내용</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                />
              </div>

              {selected.device_name && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" />
                  수신 기기: {selected.device_name}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditing(false)}
                >
                  취소
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUpdate}
                  disabled={isPending}
                >
                  {isPending ? "저장중..." : "저장"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
