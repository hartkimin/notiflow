"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { updateSettingAction } from "@/app/(dashboard)/settings/actions";

const INTERVAL_OPTIONS = [
  { value: "1", label: "1분" },
  { value: "2", label: "2분" },
  { value: "3", label: "3분" },
  { value: "5", label: "5분 (기본)" },
  { value: "10", label: "10분" },
  { value: "15", label: "15분" },
  { value: "30", label: "30분" },
  { value: "0", label: "비활성화" },
];

export function SyncSettingsForm({ syncInterval }: { syncInterval: number }) {
  const [interval, setInterval] = useState(String(syncInterval));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(value: string) {
    setInterval(value);
    startTransition(async () => {
      try {
        await updateSettingAction("sync_interval_minutes", Number(value));
        toast.success("동기화 주기가 변경되었습니다. 페이지를 새로고침하면 적용됩니다.");
        router.refresh();
      } catch {
        toast.error("설정 저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            자동 동기화
          </CardTitle>
          <CardDescription>
            대시보드 데이터를 주기적으로 자동 갱신합니다. 상단 바의 동기화 버튼으로 수동 갱신도 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="shrink-0">동기화 주기</Label>
            <Select
              value={interval}
              disabled={isPending}
              onValueChange={handleChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Supabase Realtime(WebSocket)으로 실시간 변경사항을 수신하며,
            자동 동기화는 연결이 끊어졌을 때의 보완 역할을 합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
