"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, ClipboardList } from "lucide-react";
import { getOrderDetailAction } from "@/app/(dashboard)/sales/actions";
import { downloadExcel } from "./excel-download";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import type { OrderDetailRow } from "@/lib/queries/sales-stats";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

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

const STATUS_LABEL: Record<string, string> = { draft: "임시", confirmed: "접수", delivered: "배송완료", invoiced: "정산완료", cancelled: "취소" };
const STATUS_COLORS: Record<string, string> = { draft: "#a78bfa", confirmed: "#63b3ed", delivered: "#38a169", invoiced: "#006a34", cancelled: "#fc8181" };

export function OrderSection({ initialData, initialMonth }: { initialData: OrderDetailRow[]; initialMonth: string }) {
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialMonth);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (month === initialMonth) return;
    startTransition(async () => {
      const result = await getOrderDetailAction(month).catch(() => []);
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

  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of data) {
      const d = o.order_date;
      map.set(d, (map.get(d) ?? 0) + o.revenue);
    }
    return [...map.entries()].sort().map(([date, revenue]) => ({ date: date.slice(5), 매출: revenue }));
  }, [data]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of data) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return [...map.entries()].map(([status, count]) => ({ name: STATUS_LABEL[status] ?? status, value: count, status }));
  }, [data]);

  function handleDownload() {
    const exportData = data.map((o) => ({
      ...o,
      status: ORDER_STATUS_LABELS[o.status] || o.status,
    }));
    downloadExcel(exportData as unknown as Record<string, unknown>[], `주문별실적_${month}`, {
      order_number: "주문번호", order_date: "주문일", hospital_name: "거래처",
      status: "상태", item_count: "품목수", purchase: "매입", revenue: "매출",
      profit: "이익", margin: "이익률(%)", sales_rep: "담당자",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />주문별 상세 내역</CardTitle>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3">일별 매출 추이</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtWon} />
                      <Tooltip formatter={(v) => `₩${fmtWon(Number(v))}`} />
                      <Line type="monotone" dataKey="매출" stroke="#006a34" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3">주문 상태 분포</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {statusData.map((d) => (
                          <Cell key={d.name} fill={STATUS_COLORS[d.status] ?? "#ccc"} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문번호</TableHead>
                  <TableHead>주문일</TableHead>
                  <TableHead>거래처</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">품목</TableHead>
                  <TableHead className="text-right">매입(VAT)</TableHead>
                  <TableHead className="text-right">매출(VAT)</TableHead>
                  <TableHead className="text-right">이익</TableHead>
                  <TableHead className="text-right w-14">이익률</TableHead>
                  <TableHead>담당자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline text-sm">{o.order_number}</Link>
                    </TableCell>
                    <TableCell className="text-sm">{o.order_date}</TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]">{o.hospital_name}</TableCell>
                    <TableCell>
                      <Badge variant={ORDER_STATUS_VARIANT[o.status] ?? "secondary"} className="text-[10px]">
                        {ORDER_STATUS_LABELS[o.status] || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{o.item_count}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">₩{fmt(o.purchase)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">₩{fmt(o.revenue)}</TableCell>
                    <TableCell className={`text-right tabular-nums text-sm font-medium ${o.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(o.profit)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{o.margin.toFixed(1)}%</TableCell>
                    <TableCell className="text-sm">{o.sales_rep}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4}>합계 ({data.length}건)</TableCell>
                  <TableCell className="text-right tabular-nums">{data.reduce((s, d) => s + d.item_count, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">₩{fmt(totalPurchase)}</TableCell>
                  <TableCell className="text-right tabular-nums">₩{fmt(totalRevenue)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${totalProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(totalProfit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{totalMargin.toFixed(1)}%</TableCell>
                  <TableCell />
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
