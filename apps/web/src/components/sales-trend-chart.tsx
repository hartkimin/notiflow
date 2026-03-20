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
  ComposedChart,
  Line,
} from "recharts";
import type { MonthlySalesTrend } from "@/lib/queries/stats";

export function SalesTrendChart({ data }: { data: MonthlySalesTrend[] }) {
  // Recharts needs ascending order, but our SQL returns descending for limit. Reverse it.
  const chartData = [...data].reverse();

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
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
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
            tick={{ fontSize: 12 }}
            dx={-10}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12 }}
            dx={10}
          />
          <Tooltip 
            formatter={(value: any, name: any) => {
              if (name === "profit_margin") return [`${value}%`, "이익률"];
              return [`${Number(value).toLocaleString()}원`, name === "delivered_amount" ? "배송완료금액" : "매출이익"];
            }}
            labelStyle={{ color: "black", fontWeight: "bold", marginBottom: "4px" }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }}/>
          <Bar yAxisId="left" dataKey="delivered_amount" name="배송완료금액" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
          <Line yAxisId="right" type="monotone" dataKey="profit_margin" name="이익률" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
