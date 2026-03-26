"use client";

import { useState } from "react";
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

  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [hospital, setHospital] = useState(searchParams.get("hospital") || "all");
  const [invoice, setInvoice] = useState(searchParams.get("invoice") || "all");
  const [size, setSize] = useState(searchParams.get("size") || "15");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const search = fd.get("search") as string;

    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status && status !== "all") params.set("status", status);
    if (hospital && hospital !== "all") params.set("hospital", hospital);
    if (invoice && invoice !== "all") params.set("invoice", invoice);
    if (search) params.set("search", search);
    if (size && size !== "15") params.set("size", size);

    router.push(`/orders?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5 flex-wrap">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-7 w-[80px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          <SelectItem value="confirmed">미완료</SelectItem>
          <SelectItem value="delivered">완료</SelectItem>
        </SelectContent>
      </Select>
      <Select value={hospital} onValueChange={setHospital}>
        <SelectTrigger className="h-7 w-[110px] text-[11px]">
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
      <Select value={invoice} onValueChange={setInvoice}>
        <SelectTrigger className="h-7 w-[80px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">계산서</SelectItem>
          <SelectItem value="issued">발행</SelectItem>
          <SelectItem value="not_issued">미발행</SelectItem>
        </SelectContent>
      </Select>
      <div className="h-4 w-px bg-border shrink-0" />
      <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="h-7 w-[115px] text-[11px]" />
      <span className="text-muted-foreground text-[10px]">~</span>
      <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="h-7 w-[115px] text-[11px]" />
      <div className="h-4 w-px bg-border shrink-0" />
      <div className="relative">
        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input name="search" placeholder="검색..." defaultValue={searchParams.get("search") || ""} className="h-7 w-[120px] pl-6 text-[11px]" />
      </div>
      <Select value={size} onValueChange={setSize}>
        <SelectTrigger className="h-7 w-[65px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15">15건</SelectItem>
          <SelectItem value="30">30건</SelectItem>
          <SelectItem value="50">50건</SelectItem>
          <SelectItem value="100">100건</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="icon" variant="outline" className="h-7 w-7 shrink-0">
        <Search className="h-3 w-3" />
      </Button>
    </form>
  );
}
