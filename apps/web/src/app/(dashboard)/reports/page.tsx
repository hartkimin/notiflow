import { ShoppingCart, Package, Banknote, Receipt } from "lucide-react";
import { getSalesReport } from "@/lib/queries/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportFilters } from "@/components/report-filters";
import { SalesChart } from "@/components/sales-chart";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const period = params.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let report;
  try {
    report = await getSalesReport(period);
  } catch {
    report = null;
  }

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">매출 리포트</h1>
      </div>
      <ReportFilters />

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              title="주문 수"
              value={report.summary.total_orders}
              icon={ShoppingCart}
              color="blue"
            />
            <StatCard
              title="품목 수"
              value={report.summary.total_items}
              icon={Package}
              color="green"
            />
            <StatCard
              title="공급가액"
              value={`${report.summary.total_supply.toLocaleString("ko-KR")}원`}
              icon={Banknote}
              color="amber"
            />
            <StatCard
              title="합계"
              value={`${report.summary.total_amount.toLocaleString("ko-KR")}원`}
              icon={Receipt}
              color="purple"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">거래처별 매출</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChart rows={report.rows} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>매출처</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead>수량</TableHead>
                    <TableHead className="text-right">공급가액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.order_number}</TableCell>
                      <TableCell>{row.hospital_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.product_name}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="text-right">{row.supply_amount.toLocaleString("ko-KR")}원</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState icon={Receipt} title="해당 기간의 매출 데이터가 없습니다." />
      )}
    </>
  );
}
