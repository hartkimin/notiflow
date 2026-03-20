"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { MonthlySalesTrend } from "@/lib/queries/stats";

export function InvoiceTrendChart({ data }: { data: MonthlySalesTrend[] }) {
  const chartData = [...data].reverse();

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
            tick={{ fontSize: 12 }}
            dx={-10}
          />
          <Tooltip 
            formatter={(value: any, name: any) => {
              const label = name === "invoiced_amount" ? "발행 완료" : "미발행 금액";
              return [`${Number(value).toLocaleString()}원`, label];
            }}
            labelStyle={{ color: "black", fontWeight: "bold", marginBottom: "4px" }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }}/>
          <Bar dataKey="invoiced_amount" name="발행 완료" stackId="a" fill="#3b82f6" />
          <Bar dataKey="uninvoiced_amount" name="미발행 금액" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
