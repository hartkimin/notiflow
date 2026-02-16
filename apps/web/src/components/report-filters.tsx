"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ReportFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const period = fd.get("period") as string;
    router.push(`/reports?period=${period}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div>
        <label className="text-xs text-muted-foreground">기간 (YYYY-MM)</label>
        <Input
          type="month"
          name="period"
          defaultValue={searchParams.get("period") || defaultPeriod}
          className="w-44"
        />
      </div>
      <Button type="submit" size="sm">조회</Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={`/api/v1/reports/sales/export?period=${searchParams.get("period") || defaultPeriod}`} download>
          CSV 내보내기
        </a>
      </Button>
    </form>
  );
}
