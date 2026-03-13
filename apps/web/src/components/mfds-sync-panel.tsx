"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
import type { MfdsSyncLog, MfdsSyncStats } from "@/lib/types";

interface MfdsSyncPanelProps {
  stats: MfdsSyncStats;
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

export function MfdsSyncPanel({ stats, logs }: MfdsSyncPanelProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSync() {
    startTransition(async () => {
      try {
        const result = await triggerMfdsSync("all");
        if (result.success) {
          const s = result.stats;
          toast.success(
            `동기화 완료: 의약품 ${s.drug_added ?? 0}건, 의료기기 ${s.device_added ?? 0}건, UDI ${s.device_std_added ?? 0}건`,
          );
        } else {
          const errMsg = result.errors?.join("; ") ?? "알 수 없는 오류";
          toast.error(`동기화 실패: ${errMsg}`);
        }
        router.refresh();
      } catch (err) {
        toast.error(`동기화 실패: ${(err as Error).message}`);
      }
    });
  }

  const lastSync = stats.last_sync;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            식약처 데이터 동기화
          </CardTitle>
          <CardDescription>
            의약품 허가정보, 의료기기 품목허가정보, 의료기기 표준코드(UDI) 3개 API를 동기화합니다.
            매일 오전 5시 자동 동기화됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status line + actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">마지막 동기화:</span>
              <span className="font-medium">{formatDate(lastSync?.started_at)}</span>
              {lastSync && (
                lastSync.status === "success" ? (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    성공
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-300">
                    <XCircle className="h-3 w-3 mr-1" />
                    실패
                  </Badge>
                )
              )}
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
                    <AlertDialogTitle>전체 동기화를 시작하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      식약처 3개 API 전체를 동기화합니다. 데이터 양에 따라 10~20분이 소요될 수 있습니다.
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

          {/* Data counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">의약품</p>
              <p className="text-xl font-bold">{stats.drug_count.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">의료기기(품목)</p>
              <p className="text-xl font-bold">{stats.device_count.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">의료기기(UDI)</p>
              <p className="text-xl font-bold">{stats.device_std_count.toLocaleString()}</p>
            </div>
          </div>

          {/* Sync logs table */}
          {showLogs && logs.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">시작시간</TableHead>
                    <TableHead className="w-[60px]">유형</TableHead>
                    <TableHead className="text-right w-[50px]">추가</TableHead>
                    <TableHead className="text-right w-[50px]">갱신</TableHead>
                    <TableHead className="text-right w-[50px]">소요</TableHead>
                    <TableHead className="w-[60px]">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const added = log.drug_added + log.device_added + log.device_std_added;
                    const updated = log.drug_updated + log.device_updated + log.device_std_updated;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{formatDate(log.started_at)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {log.trigger_type === "manual" ? "수동" : "자동"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{added.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs">{updated.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs">{formatDuration(log.duration_ms)}</TableCell>
                        <TableCell>
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : log.status === "running" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
