import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
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
import { HospitalRankChart } from "@/components/hospital-rank-chart";
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

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "임시", issued: "발행", sent: "전송", cancelled: "취소",
};
const INVOICE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary", issued: "default", sent: "default", cancelled: "destructive",
};

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
  const isCurrentMonth = selectedMonth === currentMonth;

  const selectedYear = params.year ? parseInt(params.year) : now.getFullYear();

  const [kpis, yearKpis, hospitalRank, salesReps, recentOrders, recentInvoices, monthlyTrend] = await Promise.all([
    getDashboardKpis(selectedMonth).catch(() => null),
    getYearlyKpis(selectedYear).catch(() => null),
    getHospitalRanking(10, selectedMonth).catch(() => []),
    getSalesRepPerformance(selectedMonth).catch(() => []),
    getRecentOrders(10).catch(() => []),
    getRecentInvoices(5).catch(() => []),
    getMonthlySalesTrend(6).catch((e) => { console.error("getMonthlySalesTrend error:", e); return []; }),
  ]);

  return (
    <>
      <RealtimeListener tables={["orders", "tax_invoices"]} />

      {/* ── KPI Bar: Year (left) | Month (right) ── */}
      <Card>
        <CardContent className="p-3">
          {!yearKpis && !kpis && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <AlertCircle className="h-4 w-4" />
              <span>대시보드 데이터를 불러올 수 없습니다. 페이지를 새로고침하세요.</span>
            </div>
          )}
          <div className="flex items-center gap-0 overflow-x-auto text-sm">
            {/* ── Year section ── */}
            {yearKpis && (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/dashboard?year=${selectedYear - 1}`}><ChevronLeft className="h-3 w-3" /></Link>
                  </Button>
                  <span className="text-[11px] font-bold min-w-[40px] text-center">{yearKpis.year}년</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/dashboard?year=${selectedYear + 1}`}><ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-muted-foreground text-xs">매출(VAT포함)</span>
                  <span className="font-bold text-xs">₩{fmt(yearKpis.revenue)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">이익</span>
                  <span className={`font-bold text-xs ${yearKpis.profit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(yearKpis.profit)}</span>
                  <span className="text-[10px] text-muted-foreground">{yearKpis.profitMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">주문</span>
                  <span className="font-bold text-xs">{yearKpis.orderCount}건</span>
                </div>
              </>
            )}

            <div className="h-4 w-px bg-border shrink-0 mx-3" />

            {/* ── Month section ── */}
            {kpis && (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/dashboard?month=${prevMonth}&year=${selectedYear}`}><ChevronLeft className="h-3 w-3" /></Link>
                  </Button>
                  {isCurrentMonth ? (
                    <span className="text-[11px] font-bold min-w-[35px] text-center">{parseInt(selectedMonth.slice(5))}월</span>
                  ) : (
                    <Link href="/dashboard" className="text-[11px] font-bold min-w-[45px] text-center hover:underline" title="클릭하면 이번 달로 이동">
                      {selectedMonth.slice(2, 4)}.{parseInt(selectedMonth.slice(5))}월
                    </Link>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/dashboard?month=${nextMonth}&year=${selectedYear}`}><ChevronRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-muted-foreground text-xs">매출(VAT포함)</span>
                  <span className="font-bold text-xs">₩{fmt(kpis.monthlyRevenue)}</span>
                  {kpis.revenueGrowth >= 0 ? (
                    <span className="text-[10px] text-green-600">▲{kpis.revenueGrowth.toFixed(1)}%</span>
                  ) : (
                    <span className="text-[10px] text-red-500">▼{Math.abs(kpis.revenueGrowth).toFixed(1)}%</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">이익</span>
                  <span className={`font-bold text-xs ${kpis.monthlyProfit < 0 ? "text-red-500" : "text-green-600"}`}>₩{fmt(kpis.monthlyProfit)}</span>
                  <span className="text-[10px] text-muted-foreground">{kpis.monthlyProfitMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="text-muted-foreground text-xs">주문</span>
                  <span className="font-bold text-xs">{kpis.monthlyOrderCount}건</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="text-blue-600">접수 {kpis.ordersConfirmed}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="text-green-600">배송 {kpis.ordersDelivered}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="text-emerald-600">발행 {kpis.ordersInvoiced}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <FileText className="h-3 w-3 text-purple-500" />
                  <span className="font-bold text-xs">{kpis.invoicesIssued}건</span>
                  {kpis.unbilledOrders > 0 && (
                    <Link href="/orders?status=delivered" className="text-[10px] text-orange-600 font-medium hover:underline">
                      미발행 {kpis.unbilledOrders}건 →
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 월별 매출/이익 추이 ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            월별 매출·이익 추이
          </CardTitle>
          <CardDescription>최근 6개월간 매출과 이익률 변동</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyTrend.length > 0 ? (
            <SalesTrendChart data={monthlyTrend} />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-12">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              아직 매출 데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        {/* ── 영업담당자별 실적 ── */}
        <SalesRepChart initialData={salesReps} initialMonth={selectedMonth} />

        {/* ── 거래처별 매출 Top 10 ── */}
        <HospitalRankChart initialData={hospitalRank} initialMonth={selectedMonth} />
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
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
            {recentOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">최근 주문이 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>거래처</TableHead>
                    <TableHead className="text-right">매출액</TableHead>
                    <TableHead>주문일</TableHead>
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
                      <TableCell className="text-sm truncate max-w-[120px]" title={order.hospital_name}>{order.hospital_name}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">₩{fmt(order.supply_amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{order.order_date?.slice(5) || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? "secondary"} className="text-[10px]">
                          {ORDER_STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                      <TableCell className="text-sm truncate max-w-[120px]" title={inv.buyer_name}>{inv.buyer_name}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">₩{fmt(inv.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? "secondary"} className="text-[10px]">
                          {INVOICE_STATUS_LABELS[inv.status] || inv.status}
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
