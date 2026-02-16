"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalesRow } from "@/lib/types";

export function SalesChart({ rows }: { rows: SalesRow[] }) {
  const byHospital: Record<string, number> = {};
  for (const row of rows) {
    const key = row.hospital_name || "기타";
    byHospital[key] = (byHospital[key] || 0) + row.supply_amount;
  }

  const data = Object.entries(byHospital)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
        <Tooltip formatter={(value) => `${Number(value).toLocaleString("ko-KR")}원`} />
        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
