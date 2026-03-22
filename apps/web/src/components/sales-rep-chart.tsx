"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { getSalesRepByMonthAction } from "@/app/(dashboard)/dashboard/actions";
import type { SalesRepPerformance } from "@/lib/queries/dashboard-stats";

function fmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

interface SalesRepChartProps {
  initialData: SalesRepPerformance[];
  initialMonth: string;
}

export function SalesRepChart({ initialData, initialMonth }: SalesRepChartProps) {
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialMonth);
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (viewMode === "month" && month === initialMonth) return;
    startTransition(async () => {
      try {
        if (viewMode === "year") {
          const year = month.slice(0, 4);
          const allData = new Map<string, SalesRepPerformance>();
          const promises = Array.from({ length: 12 }, (_, i) => {
            const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
            return getSalesRepByMonthAction(ym).catch(() => []);
          });
          const results = await Promise.all(promises);
          for (const monthData of results) {
            for (const rep of monthData) {
              if (!allData.has(rep.sales_rep)) {
                allData.set(rep.sales_rep, { ...rep });
              } else {
                const existing = allData.get(rep.sales_rep)!;
                existing.order_count += rep.order_count;
                existing.revenue += rep.revenue;
                existing.purchase += rep.purchase;
                existing.profit += rep.profit;
              }
            }
          }
          const result = Array.from(allData.values()).map((r) => ({
            ...r,
            margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
          }));
          setData(result.sort((a, b) => b.revenue - a.revenue));
        } else {
          const result = await getSalesRepByMonthAction(month);
          setData(result);
        }
      } catch {
        setData([]);
      }
    });
  }, [month, viewMode, initialMonth]);

  function navigate(dir: -1 | 1) {
    if (viewMode === "year") {
      const y = parseInt(month.slice(0, 4)) + dir;
      setMonth(`${y}-01`);
    } else {
      const [y, m] = month.split("-").map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  const label = viewMode === "year"
    ? `${month.slice(0, 4)}년`
    : `${month.slice(0, 4)}년 ${parseInt(month.slice(5))}월`;

  const chartData = data.map((rep, i) => ({
    name: rep.sales_rep,
    매출: rep.revenue,
    이익: rep.profit,
    이익률: Number(rep.margin.toFixed(1)),
    건수: rep.order_count,
    _color: COLORS[i % COLORS.length],
  }));

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const CustomTooltip = useCallback(({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl text-sm space-y-1.5">
        <p className="font-bold text-foreground">{d.name}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">매출</span>
          <span className="font-semibold tabular-nums text-right text-blue-600">₩{fmt(d.매출)}</span>
          <span className="text-muted-foreground">이익</span>
          <span className={`font-semibold tabular-nums text-right ${d.이익 >= 0 ? "text-emerald-600" : "text-red-500"}`}>₩{fmt(d.이익)}</span>
          <span className="text-muted-foreground">이익률</span>
          <span className="font-semibold tabular-nums text-right">{d.이익률}%</span>
          <span className="text-muted-foreground">주문</span>
          <span className="font-semibold tabular-nums text-right">{d.건수}건</span>
        </div>
      </div>
    );
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />영업담당자 실적
          </CardTitle>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-lg border p-0.5 mr-2">
              <button onClick={() => setViewMode("month")} className={`px-2 py-0.5 text-[10px] rounded transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>월별</button>
              <button onClick={() => setViewMode("year")} className={`px-2 py-0.5 text-[10px] rounded transition-colors ${viewMode === "year" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>연별</button>
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <span className="text-xs font-medium min-w-[80px] text-center">{label}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">로딩 중...</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">해당 기간 데이터가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#374151" }}
                  axisLine={{ stroke: "#d1d5db" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => fmt(v)}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }} />
                <Legend
                  formatter={(value: string) => <span className="text-xs font-medium text-foreground">{value}</span>}
                  iconType="rect"
                  iconSize={10}
                />
                <Bar dataKey="매출" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry._color} fillOpacity={0.85} />
                  ))}
                  <LabelList
                    dataKey="매출"
                    position="top"
                    formatter={(v) => fmt(v as number)}
                    style={{ fontSize: 10, fontWeight: 700, fill: "#374151" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Summary */}
            {data.length > 1 && (
              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <span className="font-semibold text-foreground">합계</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">매출 <strong className="tabular-nums text-foreground">₩{fmt(totalRevenue)}</strong></span>
                  <span className={totalProfit < 0 ? "text-red-500" : "text-emerald-600"}>
                    이익 <strong className="tabular-nums">₩{fmt(totalProfit)}</strong> ({totalMargin.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
