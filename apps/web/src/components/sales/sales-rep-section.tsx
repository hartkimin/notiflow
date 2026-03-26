"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, Download, Users } from "lucide-react";
import { getSalesRepDetailAction, getSalesRepHospitalDetailAction } from "@/app/(dashboard)/sales/actions";
import { downloadExcel } from "./excel-download";
import type { SalesRepDetail, SalesRepHospitalDetail } from "@/lib/queries/sales-stats";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";


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

interface Props {
  initialData: SalesRepDetail[];
  initialHospitalData: SalesRepHospitalDetail[];
  initialMonth: string;
}

export function SalesRepSection({ initialData, initialHospitalData, initialMonth }: Props) {
  const [data, setData] = useState(initialData);
  const [hospData, setHospData] = useState(initialHospitalData);
  const [month, setMonth] = useState(initialMonth);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (month === initialMonth) return;
    startTransition(async () => {
      const [reps, hosps] = await Promise.all([
        getSalesRepDetailAction(month).catch(() => []),
        getSalesRepHospitalDetailAction(month).catch(() => []),
      ]);
      setData(reps);
      setHospData(hosps);
    });
  }, [month, initialMonth]);

  function navigate(dir: -1 | 1) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setExpandedRep(null);
  }

  const label = `${month.slice(0, 4)}년 ${parseInt(month.slice(5))}월`;
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalPurchase = data.reduce((s, d) => s + d.purchase, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const chartData = useMemo(
    () => data.map((rep) => ({ name: rep.sales_rep, 매출: rep.revenue, 매입: rep.purchase, 이익: rep.profit })),
    [data]
  );

  function handleDownload() {
    // Export both summary and hospital detail
    const rows: Record<string, unknown>[] = [];
    for (const rep of data) {
      rows.push({
        구분: "담당자 합계",
        담당자: rep.sales_rep,
        거래처: "",
        주문건수: rep.order_count,
        품목수: rep.item_count,
        매출: rep.revenue,
        매입: rep.purchase,
        이익: rep.profit,
        "이익률(%)": Number(rep.margin.toFixed(1)),
      });
      const repHosps = hospData.filter((h) => h.sales_rep === rep.sales_rep);
      for (const h of repHosps) {
        rows.push({
          구분: "거래처별",
          담당자: rep.sales_rep,
          거래처: h.hospital_name,
          주문건수: h.order_count,
          품목수: "",
          매출: h.revenue,
          매입: h.purchase,
          이익: h.profit,
          "이익률(%)": Number(h.margin.toFixed(1)),
        });
      }
    }
    downloadExcel(rows, `영업담당자실적_${month}`);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />영업담당자별 실적</CardTitle>
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
                <h4 className="text-sm font-semibold mb-3">담당자별 매출·매입 비교</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis tickFormatter={fmtWon} />
                    <Tooltip formatter={(v) => `₩${fmtWon(Number(v))}`} />
                    <Legend />
                    <Bar dataKey="매출" fill="#006a34" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="매입" fill="#fc8181" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>담당자</TableHead>
                <TableHead className="text-right">주문</TableHead>
                <TableHead className="text-right">품목</TableHead>
                <TableHead className="text-right">매출(VAT)</TableHead>
                <TableHead className="text-right">매입(VAT)</TableHead>
                <TableHead className="text-right">이익</TableHead>
                <TableHead className="text-right w-16">이익률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((rep) => {
                const isExpanded = expandedRep === rep.sales_rep;
                const repHosps = hospData.filter((h) => h.sales_rep === rep.sales_rep);
                return (
                  <React.Fragment key={rep.sales_rep}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedRep(isExpanded ? null : rep.sales_rep)}
                    >
                      <TableCell className="px-2">
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                      </TableCell>
                      <TableCell className="font-semibold">{rep.sales_rep}</TableCell>
                      <TableCell className="text-right tabular-nums">{rep.order_count}건</TableCell>
                      <TableCell className="text-right tabular-nums">{rep.item_count}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">₩{fmt(rep.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">₩{fmt(rep.purchase)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${rep.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(rep.profit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rep.margin.toFixed(1)}%</TableCell>
                    </TableRow>
                    {isExpanded && repHosps.map((h) => (
                      <TableRow key={`${rep.sales_rep}-${h.hospital_id}`} className="bg-muted/30">
                        <TableCell />
                        <TableCell className="text-xs pl-6 text-muted-foreground">{h.hospital_name}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{h.order_count}건</TableCell>
                        <TableCell className="text-right text-xs">-</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">₩{fmt(h.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">₩{fmt(h.purchase)}</TableCell>
                        <TableCell className={`text-right tabular-nums text-xs ${h.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(h.profit)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{h.margin.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
              <TableRow className="font-bold border-t-2">
                <TableCell />
                <TableCell>합계</TableCell>
                <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.order_count, 0)}건</TableCell>
                <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.item_count, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">₩{fmt(totalRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums">₩{fmt(totalPurchase)}</TableCell>
                <TableCell className={`text-right tabular-nums ${totalProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(totalProfit)}</TableCell>
                <TableCell className="text-right tabular-nums">{totalMargin.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
