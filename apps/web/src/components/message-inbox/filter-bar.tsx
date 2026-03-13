"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
  totalCount: number;
  pendingCount: number;
}

export function InboxFilterBar({ totalCount, pendingCount }: FilterBarProps) {
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 py-1.5">
      <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="h-8 w-[120px] text-xs" />
      <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="h-8 w-[120px] text-xs" />
      <Select name="parse_status" defaultValue={searchParams.get("parse_status") || "all"}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          <SelectItem value="parsed">파싱완료</SelectItem>
          <SelectItem value="pending">대기</SelectItem>
          <SelectItem value="failed">실패</SelectItem>
          <SelectItem value="skipped">건너뜀</SelectItem>
        </SelectContent>
      </Select>
      <Select name="source_app" defaultValue={searchParams.get("source_app") || "all"}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 출처</SelectItem>
          <SelectItem value="kakaotalk">카카오톡</SelectItem>
          <SelectItem value="sms">SMS</SelectItem>
          <SelectItem value="telegram">텔레그램</SelectItem>
          <SelectItem value="manual">수동</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
        <Search className="h-3.5 w-3.5" />
      </Button>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
        <span>전체 <strong className="text-foreground">{totalCount}</strong>건</span>
        {pendingCount > 0 && (
          <span>· 미처리 <strong className="text-orange-600">{pendingCount}</strong>건</span>
        )}
      </div>
    </form>
  );
}
