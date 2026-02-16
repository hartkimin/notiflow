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
  ArrowUp, ArrowDown, ArrowUpDown, Smartphone,
} from "lucide-react";
import { updateDevice } from "@/lib/actions";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import type { MobileDevice } from "@/lib/types";

const COL_DEFAULTS: Record<string, number> = {
  user_name: 100, device: 160, app_version: 90, os_version: 90, last_sync: 140, is_active: 70,
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
            <ResizableTh width={widths.last_sync} colKey="last_sync" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("last_sync_at")}>
              <span className="inline-flex items-center">마지막 동기화<SortIcon active={sortKey === "last_sync_at"} dir={sortDir} /></span>
            </ResizableTh>
            <ResizableTh width={widths.is_active} colKey="is_active" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("is_active")}>
              <span className="inline-flex items-center">상태<SortIcon active={sortKey === "is_active"} dir={sortDir} /></span>
            </ResizableTh>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
