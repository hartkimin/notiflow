"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { getHospitalRankByMonthAction } from "@/app/(dashboard)/dashboard/actions";
import type { HospitalRanking } from "@/lib/queries/dashboard-stats";

function fmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

interface HospitalRankChartProps {
  initialData: HospitalRanking[];
  initialMonth: string;
}

export function HospitalRankChart({ initialData, initialMonth }: HospitalRankChartProps) {
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
          const allData = new Map<number, HospitalRanking>();
          const promises = Array.from({ length: 12 }, (_, i) => {
            const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
            return getHospitalRankByMonthAction(ym).catch(() => []);
          });
          const results = await Promise.all(promises);
          for (const monthData of results) {
            for (const h of monthData) {
              if (!allData.has(h.hospital_id)) {
                allData.set(h.hospital_id, { ...h });
              } else {
                const existing = allData.get(h.hospital_id)!;
                existing.order_count += h.order_count;
                existing.revenue += h.revenue;
                existing.purchase += h.purchase;
                existing.profit += h.profit;
              }
            }
          }
          const result = Array.from(allData.values()).map((h) => ({
            ...h,
            margin: h.revenue > 0 ? (h.profit / h.revenue) * 100 : 0,
          }));
          setData(result.sort((a, b) => b.revenue - a.revenue).slice(0, 10));
        } else {
          const result = await getHospitalRankByMonthAction(month);
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

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />거래처별 매출 Top 10
          </CardTitle>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 rounded-lg border p-0.5 mr-2">
              <button
                onClick={() => setViewMode("month")}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                월별
              </button>
              <button
                onClick={() => setViewMode("year")}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${viewMode === "year" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                연별
              </button>
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium min-w-[80px] text-center">{label}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">로딩 중...</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">해당 기간 데이터가 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {data.map((h, i) => {
              const revenueWidth = (h.revenue / maxRevenue) * 100;
              const profitRatio = h.revenue > 0 ? (h.profit / h.revenue) : 0;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <div key={h.hospital_id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {medal ? (
                        <span className="text-sm">{medal}</span>
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                      )}
                      <span className="text-sm font-semibold truncate max-w-[140px]">{h.hospital_name}</span>
                      <span className="text-[10px] text-muted-foreground">{h.order_count}건</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">₩{fmt(h.revenue)}</span>
                  </div>
                  <div className="relative h-7 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-md transition-all duration-500 ease-out"
                      style={{ width: `${revenueWidth}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2.5">
                      <span className="text-[11px] font-semibold text-white drop-shadow-sm z-10">매출</span>
                      <span className={`text-[11px] font-bold z-10 ${profitRatio >= 0 ? "text-emerald-300 drop-shadow-sm" : "text-red-300"}`}>
                        이익 ₩{fmt(h.profit)} ({h.margin.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${profitRatio >= 0.3 ? "bg-emerald-500" : profitRatio >= 0.15 ? "bg-emerald-400" : profitRatio >= 0 ? "bg-yellow-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(Math.max(profitRatio * 100, 0), 100)}%` }}
                      title={`이익률 ${h.margin.toFixed(1)}%`}
                    />
                  </div>
                </div>
              );
            })}
            {data.length > 1 && (() => {
              const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
              const totalProfit = data.reduce((s, d) => s + d.profit, 0);
              const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
              return (
                <div className="flex items-center justify-between pt-3 border-t text-xs">
                  <span className="font-semibold">합계 (Top {data.length})</span>
                  <div className="flex items-center gap-4">
                    <span>매출 <strong className="tabular-nums">₩{fmt(totalRevenue)}</strong></span>
                    <span className={totalProfit < 0 ? "text-red-500" : "text-emerald-600"}>
                      이익 <strong className="tabular-nums">₩{fmt(totalProfit)}</strong> ({totalMargin.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
