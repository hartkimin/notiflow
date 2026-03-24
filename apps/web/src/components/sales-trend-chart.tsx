"use client";

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
import type { MonthlySalesTrend } from "@/lib/queries/stats";

function fmtWon(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

export function SalesTrendChart({ data }: { data: MonthlySalesTrend[] }) {
  const chartData = [...data].reverse();

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            fontSize={12}
            dy={10}
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
          <Bar yAxisId="left" dataKey="supply_amount" name="매출(VAT포함)" fill="#006a34" radius={[4, 4, 0, 0]} barSize={36} />
          <Bar yAxisId="left" dataKey="profit_amount" name="이익" fill="#68d391" radius={[4, 4, 0, 0]} barSize={36} />
          <Line yAxisId="right" type="monotone" dataKey="profit_margin" name="이익률" stroke="#f6ad55" strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
