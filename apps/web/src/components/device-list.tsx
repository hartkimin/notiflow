"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUp, ArrowDown, ArrowUpDown, Smartphone, Circle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateDevice, requestDeviceSync } from "@/lib/actions";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import type { MobileDevice } from "@/lib/types";

const COL_DEFAULTS: Record<string, number> = {
  user_name: 100, device: 150, app_version: 80, os_version: 80, heartbeat: 80, last_sync: 130, is_active: 70,
};

type HeartbeatStatus = "online" | "away" | "offline";

function getHeartbeatStatus(lastSyncAt: string): HeartbeatStatus {
  const diff = Date.now() - new Date(lastSyncAt).getTime();
  const minutes = diff / 60000;
  if (minutes < 5) return "online";
  if (minutes < 60) return "away";
  return "offline";
}

const HEARTBEAT_CONFIG: Record<HeartbeatStatus, { label: string; color: string; description: string }> = {
  online: { label: "온라인", color: "text-green-500", description: "5분 이내 동기화" },
  away: { label: "자리비움", color: "text-yellow-500", description: "1시간 이내 동기화" },
  offline: { label: "오프라인", color: "text-muted-foreground", description: "1시간 이상 미동기화" },
};

type SortKey = "user_name" | "device_name" | "app_version" | "os_version" | "last_sync_at" | "is_active";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export function DeviceTable({ devices }: { devices: MobileDevice[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("last_sync_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { widths, onMouseDown } = useResizableColumns("devices", COL_DEFAULTS);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...devices].sort((a, b) => {
      let av: string | boolean | number;
      let bv: string | boolean | number;

      switch (sortKey) {
        case "user_name":
          av = a.user_name ?? ""; bv = b.user_name ?? ""; break;
        case "device_name":
          av = a.device_name; bv = b.device_name; break;
        case "app_version":
          av = a.app_version; bv = b.app_version; break;
        case "os_version":
          av = a.os_version; bv = b.os_version; break;
        case "last_sync_at":
          av = new Date(a.last_sync_at).getTime(); bv = new Date(b.last_sync_at).getTime(); break;
        case "is_active":
          av = a.is_active; bv = b.is_active; break;
        default:
          av = ""; bv = "";
      }

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return sortDir === "asc" ? (av === bv ? 0 : av ? -1 : 1) : (av === bv ? 0 : av ? 1 : -1);
      }
      const cmp = String(av).localeCompare(String(bv), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [devices, sortKey, sortDir]);

  function handleToggleActive(device: MobileDevice) {
    startTransition(async () => {
      try {
        await updateDevice(device.id, { is_active: !device.is_active });
        toast.success(
          device.is_active
            ? `${device.device_name} 기기가 비활성화되었습니다.`
            : `${device.device_name} 기기가 활성화되었습니다.`
        );
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "상태 변경 실패";
        toast.error(msg);
      }
    });
  }

  function handleRequestSync(device: MobileDevice) {
    startTransition(async () => {
      try {
        const result = await requestDeviceSync(device.id);
        if (result.fcm_sent > 0) {
          toast.success(`${device.device_name} 기기에 동기화 푸시를 보냈습니다.`);
        } else {
          toast.success(`${device.device_name} 기기에 Realtime으로 동기화 요청을 보냈습니다.`);
        }
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "동기화 요청 실패";
        toast.error(msg);
      }
    });
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Smartphone className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">등록된 기기가 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">
            모바일 앱에서 로그인하면 자동으로 등록됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="table-fixed">
        <thead className="[&_tr]:border-b">
          <TableRow>
            <ResizableTh width={widths.user_name} colKey="user_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("user_name")}>
              <span className="inline-flex items-center">사용자<SortIcon active={sortKey === "user_name"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.device} colKey="device" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("device_name")}>
              <span className="inline-flex items-center">기기명 / 모델<SortIcon active={sortKey === "device_name"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.app_version} colKey="app_version" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("app_version")}>
              <span className="inline-flex items-center">앱 버전<SortIcon active={sortKey === "app_version"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.os_version} colKey="os_version" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("os_version")}>
              <span className="inline-flex items-center">OS<SortIcon active={sortKey === "os_version"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.heartbeat} colKey="heartbeat" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("last_sync_at")}>
              <span className="inline-flex items-center">Heartbeat<SortIcon active={sortKey === "last_sync_at"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.last_sync} colKey="last_sync" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("last_sync_at")}>
              <span className="inline-flex items-center">마지막 동기화<SortIcon active={sortKey === "last_sync_at"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.is_active} colKey="is_active" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("is_active")}>
              <span className="inline-flex items-center">상태<SortIcon active={sortKey === "is_active"} dir={sortDir} /></span>
            </ResizableTh>
            <th className="w-[60px] px-2 text-center text-xs font-medium text-muted-foreground">
              동기화
            </th>
          </TableRow>
        </thead>
        <TableBody>
          {sorted.map((d) => (
            <TableRow key={d.id} className={!d.is_active ? "opacity-50" : undefined}>
              <TableCell className="overflow-hidden text-ellipsis">
                {d.user_name ?? <span className="text-muted-foreground text-xs">-</span>}
              </TableCell>
              <TableCell className="overflow-hidden text-ellipsis">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{d.device_name}</span>
                  {d.device_model && d.device_model !== d.device_name && (
                    <span className="text-xs text-muted-foreground">{d.device_model}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="overflow-hidden text-ellipsis">
                <Badge variant="secondary" className="font-mono text-xs">
                  v{d.app_version}
                </Badge>
              </TableCell>
              <TableCell className="overflow-hidden text-ellipsis">
                <span className="text-xs">Android {d.os_version}</span>
              </TableCell>
              <TableCell className="overflow-hidden text-ellipsis">
                {(() => {
                  const status = getHeartbeatStatus(d.last_sync_at);
                  const config = HEARTBEAT_CONFIG[status];
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1.5 cursor-default">
                          <Circle className={`h-2.5 w-2.5 fill-current ${config.color}`} />
                          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{config.description}</TooltipContent>
                    </Tooltip>
                  );
                })()}
              </TableCell>
              <TableCell className="overflow-hidden text-ellipsis">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-default">
                      {formatRelativeTime(d.last_sync_at)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {new Date(d.last_sync_at).toLocaleString("ko-KR")}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Switch
                  checked={d.is_active}
                  disabled={isPending}
                  onCheckedChange={() => handleToggleActive(d)}
                  aria-label={d.is_active ? "비활성화" : "활성화"}
                />
              </TableCell>
              <TableCell className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isPending || !d.is_active}
                      onClick={() => handleRequestSync(d)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>보류 메시지 동기화 요청</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SyncAllButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSyncAll() {
    startTransition(async () => {
      try {
        const { requestAllDevicesSync } = await import("@/lib/actions");
        const result = await requestAllDevicesSync();
        if (result.fcm_sent > 0) {
          toast.success(`${result.fcm_sent}대 기기에 동기화 푸시를 보냈습니다.`);
        } else {
          toast.success("모든 활성 기기에 Realtime으로 동기화 요청을 보냈습니다.");
        }
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "동기화 요청 실패";
        toast.error(msg);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleSyncAll}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
      전체 동기화
    </Button>
  );
}
