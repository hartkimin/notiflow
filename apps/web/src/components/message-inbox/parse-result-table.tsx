"use client";

import { Badge } from "@/components/ui/badge";
import type { RawMessage } from "@/lib/types";

export function ParseResultTable({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result;
  const items = Array.isArray(parseResult) ? parseResult : [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {msg.parse_status === "parsed" ? "파싱 결과가 없습니다." : "아직 파싱되지 않았습니다."}
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-medium">원문</th>
            <th className="text-left p-2 font-medium">매칭 제품</th>
            <th className="text-center p-2 font-medium">수량</th>
            <th className="text-center p-2 font-medium">단위</th>
            <th className="text-center p-2 font-medium">신뢰도</th>
          </tr>
        </thead>
        <tbody>
          {items.map((raw, i) => {
            const it = raw as Record<string, unknown>;
            const conf = Number(it.confidence ?? 0);
            const status = String(it.match_status ?? "unmatched");
            return (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2 text-xs font-mono">{String(it.item ?? "")}</td>
                <td className="p-2 text-sm">
                  {it.product_name ? String(it.product_name) : (
                    <span className="text-muted-foreground italic">미매칭</span>
                  )}
                </td>
                <td className="p-2 text-center font-mono">{String(it.qty ?? "")}</td>
                <td className="p-2 text-center text-xs">{String(it.unit ?? "")}</td>
                <td className="p-2 text-center">
                  <Badge
                    variant={status === "matched" ? "default" : status === "review" ? "secondary" : "outline"}
                    className={
                      status === "matched" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                      status === "review" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                      "bg-red-50 text-red-700"
                    }
                  >
                    {status === "matched" ? "매칭" : status === "review" ? "검토" : "미매칭"}
                    {conf > 0 && ` ${Math.round(conf * 100)}%`}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
