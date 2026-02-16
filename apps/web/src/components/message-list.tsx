"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
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

type SortKey = "id" | "sender" | "source_app" | "parse_status" | "received_at";
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
  return s.length > max ? s.slice(0, max) + "…" : s;
}

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

export function MessageTable({ messages }: { messages: RawMessage[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("received_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<RawMessage | null>(null);

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
                <TableHead className="max-w-[300px]">내용</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("source_app")}>
                  <span className="inline-flex items-center">출처<SortIcon active={sortKey === "source_app"} dir={sortDir} /></span>
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
                  onClick={() => setSelected(msg)}
                >
                  <TableCell className="font-mono text-xs">{msg.id}</TableCell>
                  <TableCell className="font-medium">{msg.sender || "-"}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                    {truncate(msg.content)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{SOURCE_LABEL[msg.source_app] || msg.source_app}</Badge>
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
              onClick={() => setSelected(msg)}
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
                  {msg.order_id && <span className="font-mono">주문 #{msg.order_id}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Message detail sheet */}
      <Sheet open={selected !== null} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[480px] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>메시지 상세</SheetTitle>
          </SheetHeader>
          {selected && (
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
                {selected.device_id && (
                  <div>
                    <span className="text-muted-foreground">기기 ID</span>
                    <p className="font-mono text-xs">{selected.device_id}</p>
                  </div>
                )}
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
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
