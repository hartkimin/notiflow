"use client";

import { useState, useMemo, useTransition } from "react";
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
import {
  LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown,
  Trash2, Plus, Pencil, Smartphone,
} from "lucide-react";
import { createMessage, updateMessage, deleteMessage } from "@/lib/actions";
import { ManualParseForm } from "@/components/manual-parse-form";
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
  const [showManualParse, setShowManualParse] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

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
          <Button variant={view === "list" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={view === "grid" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setView("grid")}>
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
                <TableHead>주문</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((msg) => (
                <TableRow
                  key={msg.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelected(msg); setIsEditing(false); setShowManualParse(false); }}
                >
                  <TableCell className="font-mono text-xs">{msg.id}</TableCell>
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
                  <TableCell className="font-mono text-xs">
                    {msg.order_id ? `#${msg.order_id}` : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((msg) => (
            <Card
              key={msg.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => { setSelected(msg); setIsEditing(false); setShowManualParse(false); }}
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
                  <span>{formatDate(msg.received_at)}</span>
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
          ))}
        </div>
      )}

      {/* Message detail / edit sheet */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) { setSelected(null); setIsEditing(false); } }}>
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

              {selected.parse_result && Object.keys(selected.parse_result).length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">파싱 결과</span>
                  <div className="mt-1 rounded-md border bg-muted/30 p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(selected.parse_result, null, 2)}
                    </pre>
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
