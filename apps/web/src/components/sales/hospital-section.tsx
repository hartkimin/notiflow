"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Building2 } from "lucide-react";
import { getHospitalDetailAction } from "@/app/(dashboard)/sales/actions";
import { downloadExcel } from "./excel-download";
import type { HospitalDetail } from "@/lib/queries/sales-stats";

function fmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

export function HospitalSection({ initialData, initialMonth }: { initialData: HospitalDetail[]; initialMonth: string }) {
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialMonth);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (month === initialMonth) { setData(initialData); return; }
    startTransition(async () => {
      const result = await getHospitalDetailAction(month).catch(() => []);
      setData(result);
    });
  }, [month, initialMonth, initialData]);

  function navigate(dir: -1 | 1) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const label = `${month.slice(0, 4)}년 ${parseInt(month.slice(5))}월`;
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalPurchase = data.reduce((s, d) => s + d.purchase, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  function handleDownload() {
    downloadExcel(data as unknown as Record<string, unknown>[], `거래처별실적_${month}`, {
      hospital_name: "거래처", sales_rep: "담당자", order_count: "주문건수", item_count: "품목수",
      revenue: "매출", purchase: "매입", profit: "이익", margin: "이익률(%)",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />거래처별 실적</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <span className="text-xs font-medium min-w-[80px] text-center">{label}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleDownload} disabled={data.length === 0}>
              <Download className="h-3 w-3" />엑셀
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="text-sm text-muted-foreground text-center py-6">로딩 중...</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">해당 기간 데이터가 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead className="text-right">주문</TableHead>
                <TableHead className="text-right">품목</TableHead>
                <TableHead className="text-right">매출</TableHead>
                <TableHead className="text-right">매입</TableHead>
                <TableHead className="text-right">이익</TableHead>
                <TableHead className="text-right w-16">이익률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((h, i) => (
                <TableRow key={h.hospital_id}>
                  <TableCell className="text-muted-foreground font-bold">{i + 1}</TableCell>
                  <TableCell className="font-medium truncate max-w-[150px]">{h.hospital_name}</TableCell>
                  <TableCell className="text-xs">{h.sales_rep}</TableCell>
                  <TableCell className="text-right tabular-nums">{h.order_count}건</TableCell>
                  <TableCell className="text-right tabular-nums">{h.item_count}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">₩{fmt(h.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">₩{fmt(h.purchase)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${h.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(h.profit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{h.margin.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={3}>합계 ({data.length}개 거래처)</TableCell>
                <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.order_count, 0)}건</TableCell>
                <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.item_count, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">₩{fmt(totalRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums">₩{fmt(totalPurchase)}</TableCell>
                <TableCell className={`text-right tabular-nums ${totalProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(totalProfit)}</TableCell>
                <TableCell className="text-right tabular-nums">{totalMargin.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
