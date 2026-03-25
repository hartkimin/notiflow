"use client";

import { useState, useTransition } from "react";
import {
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonthlySalesTrend } from "@/lib/queries/stats";
import {
  getDailySalesTrendAction,
  type DailySalesTrend,
} from "@/app/(dashboard)/dashboard/actions";

function fmtWon(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

function getMonthOffset(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}년 ${m}월`;
}

type ViewMode = "monthly" | "daily";

interface Props {
  data: MonthlySalesTrend[];
  currentMonth: string; // "YYYY-MM"
}

export function SalesTrendChart({ data, currentMonth }: Props) {
  const [mode, setMode] = useState<ViewMode>("monthly");
  const [dailyMonth, setDailyMonth] = useState(currentMonth);
  const [dailyData, setDailyData] = useState<DailySalesTrend[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const monthlyChartData = [...data].reverse();

  function switchToDaily(month?: string) {
    const m = month ?? dailyMonth;
    setMode("daily");
    setDailyMonth(m);
    startTransition(async () => {
      const result = await getDailySalesTrendAction(m);
      setDailyData(result);
    });
  }

  function navigateMonth(offset: number) {
    const newMonth = getMonthOffset(dailyMonth, offset);
    setDailyMonth(newMonth);
    startTransition(async () => {
      const result = await getDailySalesTrendAction(newMonth);
      setDailyData(result);
    });
  }

  const chartData = mode === "monthly"
    ? monthlyChartData.map((d) => ({
        label: d.month,
        supply_amount: d.supply_amount,
        profit_amount: d.profit_amount,
        profit_margin: d.profit_margin,
      }))
    : (dailyData ?? []).map((d) => ({
        label: `${d.day}일`,
        supply_amount: d.supply_amount,
        profit_amount: d.profit_amount,
        profit_margin: d.profit_margin,
      }));

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "monthly" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setMode("monthly")}
          >
            월별
          </Button>
          <Button
            variant={mode === "daily" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => switchToDaily()}
          >
            일별
          </Button>
        </div>

        {mode === "daily" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateMonth(-1)}
              disabled={isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[90px] text-center">
              {formatMonthLabel(dailyMonth)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateMonth(1)}
              disabled={isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className={`h-[300px] w-full ${isPending ? "opacity-50" : ""}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              fontSize={mode === "daily" ? 10 : 12}
              dy={10}
              interval={mode === "daily" ? 1 : 0}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtWon}
              fontSize={12}
              dx={-10}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              fontSize={12}
              dx={10}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "이익률") return [`${value}%`, "이익률"];
                return [`₩${fmtWon(Number(value))}`, name];
              }}
              labelStyle={{ color: "black", fontWeight: "bold", marginBottom: "4px" }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <Bar
              yAxisId="left"
              dataKey="supply_amount"
              name="매출(VAT포함)"
              fill="#006a34"
              radius={[4, 4, 0, 0]}
              barSize={mode === "daily" ? 14 : 36}
            />
            <Bar
              yAxisId="left"
              dataKey="profit_amount"
              name="이익"
              fill="#68d391"
              radius={[4, 4, 0, 0]}
              barSize={mode === "daily" ? 14 : 36}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="profit_margin"
              name="이익률"
              stroke="#f6ad55"
              strokeWidth={2}
              dot={{ r: mode === "daily" ? 2 : 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
