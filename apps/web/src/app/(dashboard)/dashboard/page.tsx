import Link from "next/link";
import {
  ArrowUpRight,
  TrendingUp,
  FileText,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RealtimeListener } from "@/components/realtime-listener";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import {
  getDashboardKpis,
  getYearlyKpis,
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

function getMonthOffset(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function DashboardHome({ searchParams }: Props) {
  const params = await searchParams;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = params.month || currentMonth;
  const prevMonth = getMonthOffset(selectedMonth, -1);
  const nextMonth = getMonthOffset(selectedMonth, 1);
  const monthLabel = `${selectedMonth.slice(0, 4)}년 ${parseInt(selectedMonth.slice(5))}월`;
  const isCurrentMonth = selectedMonth === currentMonth;

  const selectedYear = params.year ? parseInt(params.year) : now.getFullYear();

  const [kpis, yearKpis, hospitalRank, salesReps, recentOrders, recentInvoices, monthlyTrend] = await Promise.all([
    getDashboardKpis(selectedMonth).catch(() => null),
    getYearlyKpis(selectedYear).catch(() => null),
    getHospitalRanking(10).catch(() => []),
    getSalesRepPerformance(selectedMonth).catch(() => []),
    getRecentOrders(10).catch(() => []),
    getRecentInvoices(5).catch(() => []),
    getMonthlySalesTrend(6).catch(() => []),
  ]);

  return (
    <>
      <RealtimeListener tables={["orders", "tax_invoices"]} />
      <h1 className="text-lg font-semibold md:text-2xl">대시보드</h1>

      {/* ── Yearly KPI Bar ── */}
      {yearKpis && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-4 overflow-x-auto text-sm">
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/dashboard?year=${selectedYear - 1}&month=${selectedMonth}`}><ChevronLeft className="h-3.5 w-3.5" /></Link>
                </Button>
                <span className="text-xs font-semibold min-w-[50px] text-center">{yearKpis.year}년</span>
                <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/dashboard?year=${selectedYear + 1}&month=${selectedMonth}`}><ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-muted-foreground">연매출</span>
                <span className="font-bold">₩{fmt(yearKpis.revenue)}</span>
                {yearKpis.revenueGrowth >= 0 ? (
                  <span className="text-[10px] text-green-600">▲{yearKpis.revenueGrowth.toFixed(1)}%</span>
                ) : (
                  <span className="text-[10px] text-red-500">▼{Math.abs(yearKpis.revenueGrowth).toFixed(1)}%</span>
                )}
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">이익</span>
                <span className={`font-bold ${yearKpis.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(yearKpis.profit)}</span>
                <span className="text-[10px] text-muted-foreground">{yearKpis.profitMargin.toFixed(1)}%</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">주문</span>
                <span className="font-bold">{yearKpis.orderCount}건</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <FileText className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-muted-foreground">계산서</span>
                <span className="font-bold">{yearKpis.invoicesIssued}건</span>
                {yearKpis.unbilledOrders > 0 && (
                  <span className="text-[10px] text-orange-600 font-medium">미발행 {yearKpis.unbilledOrders}건</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Monthly KPI Bar ── */}
      {kpis && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-4 overflow-x-auto text-sm">
              {/* Month navigation */}
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/dashboard?month=${prevMonth}`}><ChevronLeft className="h-3.5 w-3.5" /></Link>
                </Button>
                {isCurrentMonth ? (
                  <span className="text-xs font-semibold min-w-[80px] text-center">{monthLabel}</span>
                ) : (
                  <Link href="/dashboard" className="text-xs font-semibold min-w-[80px] text-center hover:underline">{monthLabel}</Link>
                )}
                <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/dashboard?month=${nextMonth}`}><ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              {/* 매출 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-muted-foreground">매출</span>
                <span className="font-bold">₩{fmt(kpis.monthlyRevenue)}</span>
                {kpis.revenueGrowth >= 0 ? (
                  <span className="text-[10px] text-green-600">▲{kpis.revenueGrowth.toFixed(1)}%</span>
                ) : (
                  <span className="text-[10px] text-red-500">▼{Math.abs(kpis.revenueGrowth).toFixed(1)}%</span>
                )}
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              {/* 이익 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">이익</span>
                <span className={`font-bold ${kpis.monthlyProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(kpis.monthlyProfit)}</span>
                <span className="text-[10px] text-muted-foreground">{kpis.monthlyProfitMargin.toFixed(1)}%</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              {/* 주문 */}
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

      {/* ── 월별 매출/이익 추이 ── */}
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
        {/* ── 영업담당자별 실적 ── */}
        <SalesRepChart initialData={salesReps} initialMonth={selectedMonth} />

        {/* ── 거래처별 매출 Top 10 ── */}
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
