"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, History, CheckCircle2, XCircle, Loader2, Database, ArrowDownToLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { triggerMfdsSync } from "@/lib/actions";
import type { MfdsSyncLog, MfdsSyncStats, MfdsSyncMeta } from "@/lib/types";

interface MfdsSyncPanelProps {
  stats: MfdsSyncStats & {
    meta?: {
      drug: MfdsSyncMeta | null;
      device_std: MfdsSyncMeta | null;
    };
  };
  logs: MfdsSyncLog[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "\u2014";
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "\u2014";
  if (ms < 60_000) return `${Math.round(ms / 1000)}\uCD08`;
  return `${Math.round(ms / 60_000)}\uBD84`;
}

function CompletenessBar({ local, api }: { local: number; api: number | null }) {
  if (!api || api === 0) return null;
  const pct = Math.min(100, Math.round((local / api) * 100));
  const isLow = pct < 90;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? "bg-amber-500" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${isLow ? "text-amber-600" : "text-muted-foreground"}`}>
        {pct}%
      </span>
    </div>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "partial":
      return <ArrowDownToLine className="h-4 w-4 text-amber-500" />;
    default:
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function syncModeBadge(mode: string | null) {
  if (mode === "full") {
    return <Badge variant="secondary" className="text-xs"><Database className="h-3 w-3 mr-0.5" />전체</Badge>;
  }
  return <Badge variant="outline" className="text-xs">증분</Badge>;
}

export function MfdsSyncPanel({ stats, logs }: MfdsSyncPanelProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSync() {
    startTransition(async () => {
      try {
        const result = await triggerMfdsSync("all");
        if (result.success) {
          toast.success("동기화가 시작되었습니다. 진행 상황은 자동으로 업데이트됩니다.");
        } else {
          const errors = result.errors as string[] | null;
          const errMsg = errors?.join("; ") ?? "알 수 없는 오류";
          toast.error(`동기화 시작 실패: ${errMsg}`);
        }
        router.refresh();
      } catch (err) {
        toast.error(`동기화 실패: ${(err as Error).message}`);
      }
    });
  }

  const meta = stats.meta;
  const drugMeta = meta?.drug;
  const deviceMeta = meta?.device_std;

  // Detect if full sync is needed
  const needsFullSync = (m: MfdsSyncMeta | null | undefined, localCount: number) => {
    if (!m) return true; // No meta = never synced
    if (!m.last_full_sync_at) return true;
    if (m.api_total_count && localCount / m.api_total_count < 0.9) return true;
    return false;
  };

  const drugNeedsFull = needsFullSync(drugMeta, stats.drug_count);
  const deviceNeedsFull = needsFullSync(deviceMeta, stats.device_std_count);

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            식약처 데이터 동기화
          </CardTitle>
          <CardDescription>
            의약품 허가정보, 의료기기 표준코드(UDI) 2개 API를 동기화합니다.
            매일 오전 4시 자동 동기화됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Completeness warning */}
          {(drugNeedsFull || deviceNeedsFull) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-amber-800 dark:text-amber-200">전체 동기화 필요</span>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                  {drugNeedsFull && "의약품 "}
                  {drugNeedsFull && deviceNeedsFull && "및 "}
                  {deviceNeedsFull && "의료기기(UDI) "}
                  데이터가 불완전합니다. 검색 패널에서 전체 동기화를 실행하세요.
                </p>
              </div>
            </div>
          )}

          {/* Status line + actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">마지막 동기화:</span>
              <span className="font-medium">
                {stats.last_sync ? formatDate(typeof stats.last_sync === 'string' ? stats.last_sync : null) : "\u2014"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogs((v) => !v)}
              >
                <History className="h-4 w-4 mr-1" />
                이력
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        동기화 중...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        동기화
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>동기화를 시작하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      식약처 API를 동기화합니다. 데이터 양에 따라 시간이 소요될 수 있습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSync}>시작</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Data counts with completeness */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">의약품</p>
              <p className="text-xl font-bold">{stats.drug_count.toLocaleString()}</p>
              {drugMeta?.api_total_count && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    API: {drugMeta.api_total_count.toLocaleString()}건
                  </p>
                  <CompletenessBar local={stats.drug_count} api={drugMeta.api_total_count} />
                </>
              )}
              {drugMeta?.last_full_sync_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  전체동기화: {formatDate(drugMeta.last_full_sync_at)}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">의료기기(UDI)</p>
              <p className="text-xl font-bold">{stats.device_std_count.toLocaleString()}</p>
              {deviceMeta?.api_total_count && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    API: {deviceMeta.api_total_count.toLocaleString()}건
                  </p>
                  <CompletenessBar local={stats.device_std_count} api={deviceMeta.api_total_count} />
                </>
              )}
              {deviceMeta?.last_full_sync_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  전체동기화: {formatDate(deviceMeta.last_full_sync_at)}
                </p>
              )}
            </div>
          </div>

          {/* Sync logs table */}
          {showLogs && logs.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">시작시간</TableHead>
                    <TableHead className="w-[50px]">유형</TableHead>
                    <TableHead className="w-[50px]">모드</TableHead>
                    <TableHead className="text-right w-[60px]">Fetch</TableHead>
                    <TableHead className="text-right w-[60px]">Upsert</TableHead>
                    <TableHead className="text-right w-[50px]">소요</TableHead>
                    <TableHead className="w-[40px]">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{formatDate(log.started_at)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {log.trigger_type === "manual" ? "수동" : "자동"}
                        </Badge>
                      </TableCell>
                      <TableCell>{syncModeBadge(log.sync_mode)}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {(log.total_fetched ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {(log.total_upserted ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs">{formatDuration(log.duration_ms)}</TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {showLogs && logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              동기화 이력이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
