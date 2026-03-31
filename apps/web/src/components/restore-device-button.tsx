"use client";

import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestDeviceRestore } from "@/lib/actions";

interface RestoreDeviceButtonProps {
  deviceId: string;
  deviceName: string;
}

export function RestoreDeviceButton({ deviceId, deviceName }: RestoreDeviceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function handleRestore() {
    if (!confirm(`"${deviceName}" 기기에 복원 요청을 보내시겠습니까?\n앱이 서버 데이터를 다운로드하여 복원합니다.`)) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await requestDeviceRestore(deviceId);
      setResult(res);
    } catch {
      setResult({ success: false, error: "요청 실패" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleRestore} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
        복원 요청
      </Button>
      {result && (
        <span className={`text-xs ${result.success ? "text-green-600" : "text-red-600"}`}>
          {result.success ? "전송 완료" : result.error}
        </span>
      )}
    </div>
  );
}
