"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { memo, useMemo } from "react";
import type { TrendPoint } from "@/lib/types";

export const TrendChart = memo(function TrendChart({ data }: { data: TrendPoint[] }) {
  const formatted = useMemo(
    () => data.map((d) => ({ ...d, label: d.date.slice(5) })),
    [data],
  );

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={formatted} margin={{ left: -10, right: -10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" fontSize={11} interval="preserveStartEnd" />
        <YAxis yAxisId="count" fontSize={11} width={35} />
        <YAxis
          yAxisId="amount"
          orientation="right"
          fontSize={11}
          width={45}
          tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
        />
        <Tooltip
          formatter={(value, name) => {
            const v = Number(value);
            if (name === "total_amount")
              return [`${v.toLocaleString("ko-KR")}원`, "매출"];
            if (name === "orders") return [v, "주문"];
            return [v, "메시지"];
          }}
          labelFormatter={(label) => `날짜: ${label}`}
        />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              messages: "메시지",
              orders: "주문",
              total_amount: "매출",
            };
            return labels[value] || value;
          }}
        />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="messages"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="orders"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="amount"
          type="monotone"
          dataKey="total_amount"
          stroke="hsl(142 76% 36%)"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
