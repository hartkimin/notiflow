import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";
import type { SalesRepStat } from "@/lib/queries/stats";

export function SalesRepTable({ data }: { data: SalesRepStat[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> 이번 달 영업담당자별 실적
          </CardTitle>
          <CardDescription>
            담당자별 매출액 및 매출 이익률 현황입니다.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={Users} title="영업 실적 데이터가 없습니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>영업담당자</TableHead>
                <TableHead className="text-right">매출액</TableHead>
                <TableHead className="text-right">매출 이익</TableHead>
                <TableHead className="text-right">이익률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {row.sales_rep}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(row.sales_amount).toLocaleString("ko-KR")}원
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(row.profit_amount).toLocaleString("ko-KR")}원
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">
                    {row.profit_margin}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
