"use client";

import { useState } from "react";
import { File, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface OrderExportButtonProps {
  params?: {
    status?: string;
    hospital_id?: string;
    from?: string;
    to?: string;
    search?: string;
  };
}

export function OrderExportButton({ params }: OrderExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(mode: "orders" | "items") {
    setIsExporting(true);
    try {
      const qs = new URLSearchParams();
      qs.set("mode", mode);
      if (params?.status) qs.set("status", params.status);
      if (params?.hospital_id) qs.set("hospital_id", params.hospital_id);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      if (params?.search) qs.set("search", params.search);

      const res = await fetch(`/api/orders/export?${qs}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "내보내기 실패" }));
        throw new Error(err.error);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      const suffix = mode === "orders" ? "주문목록" : "주문목록_품목포함";
      a.download = `${suffix}_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("엑셀 파일이 다운로드되었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "내보내기에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1" disabled={isExporting}>
          {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <File className="h-3.5 w-3.5" />}
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">내보내기</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("orders")}>
          주문 목록만
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("items")}>
          품목 포함
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
