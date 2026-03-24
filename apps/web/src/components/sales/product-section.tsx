"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Package } from "lucide-react";
import { getProductPerformanceAction } from "@/app/(dashboard)/sales/actions";
import { downloadExcel } from "./excel-download";
import type { ProductPerformance } from "@/lib/queries/sales-stats";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CHART_COLORS = ["#006a34", "#38a169", "#68d391", "#f6ad55", "#fc8181", "#a78bfa", "#63b3ed", "#f687b3"];

function fmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

function fmtWon(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

export function ProductSection({ initialData, initialMonth }: { initialData: ProductPerformance[]; initialMonth: string }) {
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialMonth);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (month === initialMonth) return;
    startTransition(async () => {
      const result = await getProductPerformanceAction(month).catch(() => []);
      setData(result);
    });
  }, [month, initialMonth]);

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

  const prodChartData = useMemo(
    () =>
      data
        .slice(0, 20)
        .map((p) => ({ name: p.product_name.slice(0, 12), 매출: p.revenue, 이익: p.profit })),
    [data]
  );

  function handleDownload() {
    downloadExcel(data as unknown as Record<string, unknown>[], `품목별실적_${month}`, {
      product_name: "품목명", order_count: "주문건수", total_quantity: "수량",
      revenue: "매출", purchase: "매입", profit: "이익", margin: "이익률(%)",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />품목별 실적</CardTitle>
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
          <>
            {data.length > 0 && (
              <div className="rounded-lg border p-4 mb-4">
                <h4 className="text-sm font-semibold mb-3">품목별 매출 Top {Math.min(20, data.length)}</h4>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={prodChartData} margin={{ left: 10, right: 10, top: 5, bottom: 50 }} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} angle={-35} textAnchor="end" height={65} interval={0} />
                    <YAxis tickFormatter={fmtWon} />
                    <Tooltip formatter={(v) => `₩${fmtWon(Number(v))}`} />
                    <Bar dataKey="매출" radius={[3, 3, 0, 0]}>
                      {prodChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>품목명</TableHead>
                  <TableHead className="text-right">주문</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">매출(VAT)</TableHead>
                  <TableHead className="text-right">매입(VAT)</TableHead>
                  <TableHead className="text-right">이익</TableHead>
                  <TableHead className="text-right w-16">이익률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p, i) => (
                  <TableRow key={p.product_name}>
                    <TableCell className="text-muted-foreground font-bold">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm truncate max-w-[200px]">{p.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.order_count}건</TableCell>
                    <TableCell className="text-right tabular-nums">{p.total_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">₩{fmt(p.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">₩{fmt(p.purchase)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${p.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(p.profit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.margin.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={2}>합계 ({data.length}개 품목)</TableCell>
                  <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.order_count, 0)}건</TableCell>
                  <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.total_quantity, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">₩{fmt(totalRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">₩{fmt(totalPurchase)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${totalProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(totalProfit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{totalMargin.toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
