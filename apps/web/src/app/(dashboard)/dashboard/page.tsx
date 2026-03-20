import Link from "next/link";
import {
  ArrowUpRight,
  TrendingUp,
  BarChart2,
  FileText,
  Building2,
  ClipboardList,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RealtimeListener } from "@/components/realtime-listener";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import {
  getDashboardKpis,
  getHospitalRanking,
  getSalesRepPerformance,
  getRecentOrders,
  getRecentInvoices,
} from "@/lib/queries/dashboard-stats";
import { getMonthlySalesTrend } from "@/lib/queries/stats";
import { SalesRepChart } from "@/components/sales-rep-chart";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const SalesTrendChart = dynamic(
  () => import("@/components/sales-trend-chart").then(m => ({ default: m.SalesTrendChart })),
  { loading: () => <Skeleton className="h-[250px] w-full rounded-md" /> },
);

function fmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

export default async function DashboardHome() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [kpis, hospitalRank, salesReps, recentOrders, recentInvoices, monthlyTrend] = await Promise.all([
    getDashboardKpis().catch(() => null),
    getHospitalRanking(10).catch(() => []),
    getSalesRepPerformance(currentMonth).catch(() => []),
    getRecentOrders(10).catch(() => []),
    getRecentInvoices(5).catch(() => []),
    getMonthlySalesTrend(6).catch(() => []),
  ]);

  return (
    <>
      <RealtimeListener tables={["orders", "tax_invoices"]} />
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">대시보드</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1" asChild>
            <Link href="/orders/new">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">주문 추가</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      {kpis && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-5 overflow-x-auto text-sm">
              {/* 당월 매출 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-muted-foreground">당월 매출</span>
                <span className="font-bold">₩{fmt(kpis.monthlyRevenue)}</span>
                {kpis.revenueGrowth >= 0 ? (
                  <span className="text-[10px] text-green-600">▲{kpis.revenueGrowth.toFixed(1)}%</span>
                ) : (
                  <span className="text-[10px] text-red-500">▼{Math.abs(kpis.revenueGrowth).toFixed(1)}%</span>
                )}
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              {/* 당월 이익 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">이익</span>
                <span className={`font-bold ${kpis.monthlyProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(kpis.monthlyProfit)}</span>
                <span className="text-[10px] text-muted-foreground">{kpis.monthlyProfitMargin.toFixed(1)}%</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              {/* 주문 현황 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">주문</span>
                <span className="font-bold">{kpis.monthlyOrderCount}건</span>
                <span className="text-[10px] text-muted-foreground">
                  접수 {kpis.ordersConfirmed} · 배송 {kpis.ordersDelivered} · 발행 {kpis.ordersInvoiced}
                </span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              {/* 세금계산서 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <FileText className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-muted-foreground">계산서</span>
                <span className="font-bold">{kpis.invoicesIssued}건</span>
                {kpis.unbilledOrders > 0 && (
                  <Link href="/invoices/new" className="text-[10px] text-orange-600 font-medium hover:underline">
                    미발행 {kpis.unbilledOrders}건 →
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 월별 매출/이익 추이 (대표이사용) ── */}
      {monthlyTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">월별 매출·이익 추이</CardTitle>
            <CardDescription>최근 6개월간 매출과 이익률 변동</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={monthlyTrend} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* ── 영업담당자별 실적 (영업팀용) ── */}
        <SalesRepChart initialData={salesReps} initialMonth={currentMonth} />

        {/* ── 거래처별 매출 Top 10 (경영진/영업용) ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />거래처별 매출 Top 10</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                <Link href="/hospitals">전체 보기 <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hospitalRank.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>거래처</TableHead>
                    <TableHead className="text-right">주문</TableHead>
                    <TableHead className="text-right">매출</TableHead>
                    <TableHead className="text-right">이익</TableHead>
                    <TableHead className="text-right w-14">이익률</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hospitalRank.map((h, i) => (
                    <TableRow key={h.hospital_id}>
                      <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium truncate max-w-[150px]">{h.hospital_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.order_count}건</TableCell>
                      <TableCell className="text-right tabular-nums">₩{fmt(h.revenue)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${h.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(h.profit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.margin.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* ── 최근 주문 ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">최근 주문</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                <Link href="/orders">전체 보기 <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문번호</TableHead>
                  <TableHead>거래처</TableHead>
                  <TableHead className="text-right">매출액</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline text-sm">
                        {order.order_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]">{order.hospital_name}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">₩{fmt(order.supply_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? "secondary"} className="text-[10px]">
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── 최근 세금계산서 ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">최근 세금계산서</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                <Link href="/invoices">전체 보기 <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">발행된 세금계산서가 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>발행번호</TableHead>
                    <TableHead>거래처</TableHead>
                    <TableHead className="text-right">합계(VAT포함)</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline text-sm">
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]">{inv.buyer_name}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">₩{fmt(inv.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "issued" ? "default" : inv.status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">
                          {inv.status === "draft" ? "임시" : inv.status === "issued" ? "발행" : inv.status === "cancelled" ? "취소" : inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
