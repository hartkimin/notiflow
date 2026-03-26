"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface InvoiceFiltersProps {
  hospitals?: { id: number; name: string }[];
}

export function InvoiceFilters({ hospitals = [] }: InvoiceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "all");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const hospital = fd.get("hospital") as string;
    const search = fd.get("search") as string;
    const size = fd.get("size") as string;

    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status && status !== "all") params.set("status", status);
    if (hospital && hospital !== "all") params.set("hospital", hospital);
    if (search) params.set("search", search);
    if (size && size !== "25") params.set("size", size);

    router.push(`/invoices?${params}`);
  }

  function handleStatusToggle(value: string) {
    setStatus(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.delete("page");
    router.push(`/invoices?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5 flex-wrap">
      <div className="flex h-7 rounded-md border bg-muted/40 p-0.5 shrink-0">
        {([
          { value: "all", label: "전체", color: "" },
          { value: "issued", label: "완료", color: "text-green-700" },
          { value: "cancelled", label: "취소", color: "text-red-600" },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleStatusToggle(opt.value)}
            className={`px-2 text-[11px] font-medium rounded-sm transition-colors ${
              status === opt.value
                ? `bg-background shadow-sm ${opt.color}`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Select name="hospital" defaultValue={searchParams.get("hospital") || "all"}>
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
      <div className="h-4 w-px bg-border shrink-0" />
      <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="h-7 w-[115px] text-[11px]" />
      <span className="text-muted-foreground text-[10px]">~</span>
      <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="h-7 w-[115px] text-[11px]" />
      <div className="h-4 w-px bg-border shrink-0" />
      <div className="relative">
        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input name="search" placeholder="검색..." defaultValue={searchParams.get("search") || ""} className="h-7 w-[120px] pl-6 text-[11px]" />
      </div>
      <Select name="size" defaultValue={searchParams.get("size") || "25"}>
        <SelectTrigger className="h-7 w-[65px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15">15건</SelectItem>
          <SelectItem value="25">25건</SelectItem>
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
