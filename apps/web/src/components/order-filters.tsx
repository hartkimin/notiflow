"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface OrderFiltersProps {
  hospitals?: { id: number; name: string }[];
}

export function OrderFilters({ hospitals = [] }: OrderFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const status = fd.get("status") as string;
    const hospital = fd.get("hospital") as string;
    const search = fd.get("search") as string;
    const size = fd.get("size") as string;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status && status !== "all") params.set("status", status);
    if (hospital && hospital !== "all") params.set("hospital", hospital);
    if (search) params.set("search", search);
    if (size && size !== "15") params.set("size", size);

    router.push(`/orders?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-[10px] text-muted-foreground">시작일</label>
        <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="h-8 w-[130px] text-xs" />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">종료일</label>
        <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="h-8 w-[130px] text-xs" />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">상태</label>
        <Select name="status" defaultValue={searchParams.get("status") || "all"}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="confirmed">주문완료</SelectItem>
            <SelectItem value="delivered">배송완료</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">거래처</label>
        <Select name="hospital" defaultValue={searchParams.get("hospital") || "all"}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 거래처</SelectItem>
            {hospitals.map((h) => (
              <SelectItem key={h.id} value={String(h.id)}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">검색</label>
        <Input name="search" placeholder="품목명 검색" defaultValue={searchParams.get("search") || ""} className="h-8 w-[140px] text-xs" />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">표시 개수</label>
        <Select name="size" defaultValue={searchParams.get("size") || "15"}>
          <SelectTrigger className="h-8 w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15건</SelectItem>
            <SelectItem value="30">30건</SelectItem>
            <SelectItem value="50">50건</SelectItem>
            <SelectItem value="100">100건</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" className="h-8 gap-1">
        <Search className="h-3.5 w-3.5" />
        검색
      </Button>
    </form>
  );
}
