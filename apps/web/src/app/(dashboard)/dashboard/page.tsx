import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  Truck,
  Shield,
  Building2,
  Package,
  TrendingUp,
  BarChart2,
  FileText
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { RealtimeListener } from "@/components/realtime-listener";
import { SyncAllButton } from "@/components/device-list";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TrendChart = dynamic(
  () => import("@/components/trend-chart").then(m => ({ default: m.TrendChart })),
  { loading: () => <Skeleton className="h-[250px] w-full rounded-md" /> },
);
import { SalesTrendChart } from "@/components/sales-trend-chart";
import { InvoiceTrendChart } from "@/components/invoice-trend-chart";
import { SalesRepTable } from "@/components/sales-rep-table";

import { getDailyStats, getTrendStats, getHospitalStats, getProductStats, getMonthlySalesTrend, getSalesRepStats } from "@/lib/queries/stats";
import { getOrders } from "@/lib/queries/orders";
import { getTodayDeliveries } from "@/lib/queries/deliveries";
import { getPendingKpis } from "@/lib/queries/reports";
import { ORDER_STATUS_LABELS as STATUS_LABELS } from "@/lib/order-status";

export default async function DashboardHome() {
  const [stats, ordersRes, deliveriesRes, kpisRes, trend, hospitals, products, monthlyTrend, salesRepStats] = await Promise.all([
    getDailyStats().catch(() => ({
      date: "",
      orders_created: 0,
    })),
    getOrders({ limit: 5 }).catch(() => ({ orders: [], total: 0 })),
    getTodayDeliveries().catch(() => ({ count: 0, deliveries: [] })),
    getPendingKpis().catch(() => ({ count: 0, reports: [] })),
    getTrendStats().catch(() => []),
    getHospitalStats().catch(() => []),
    getProductStats().catch(() => []),
    getMonthlySalesTrend().catch(() => []),
    getSalesRepStats().catch(() => []),
  ]);

  const currentMonth = monthlyTrend[0] || {
    order_count: 0,
    supply_amount: 0,
    profit_amount: 0,
    profit_margin: 0,
    unissued_tax_invoices: 0
  };

  return (
    <>
      <RealtimeListener tables={["orders"]} />
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">대시보드</h1>
        <div className="ml-auto flex items-center gap-2">
          <SyncAllButton />
          <Button size="sm" className="h-8 gap-1">
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              주문 추가
            </span>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
          title="당월 매출액"
          value={`${Number(currentMonth.supply_amount).toLocaleString("ko-KR")}원`}
          description="이번 달 총 매출"
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="당월 매출 이익"
          value={`${Number(currentMonth.profit_amount).toLocaleString("ko-KR")}원`}
          description={`이익률: ${currentMonth.profit_margin}%`}
          icon={BarChart2}
          color="green"
        />
        <StatCard
          title="세금계산서 미발행"
          value={`${currentMonth.unissued_tax_invoices}건`}
          description="발행 대기 중인 주문"
          icon={FileText}
          color="red"
        />
        <StatCard
          title="오늘 주문 / 배송"
          value={`${stats.orders_created}건 / ${deliveriesRes.count}건`}
          description="금일 발생 건수"
          icon={Truck}
          color="amber"
        />
      </div>

      <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-8">
          <Card>
            <CardHeader>
              <CardTitle>월별 배송완료 및 이익 추이</CardTitle>
              <CardDescription>최근 6개월간의 배송완료 금액과 이익률 변동 추이입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrend.length > 0 ? (
                <SalesTrendChart data={monthlyTrend} />
              ) : (
                <EmptyState icon={BarChart2} title="매출 데이터가 없습니다." />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>세금계산서 발행 현황</CardTitle>
              <CardDescription>배송 완료된 주문 대비 세금계산서 발행 및 미발행 금액입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrend.length > 0 ? (
                <InvoiceTrendChart data={monthlyTrend} />
              ) : (
                <EmptyState icon={FileText} title="계산서 데이터가 없습니다." />
              )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <SalesRepTable data={salesRepStats} />
        </div>
      </div>

      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>최근 주문</CardTitle>
              <CardDescription>
                최근 5개의 주문 목록입니다.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/orders">
                전체 보기
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문번호</TableHead>
                  <TableHead className="hidden sm:table-cell">거래처</TableHead>
                  <TableHead className="text-right">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersRes.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-medium">{order.order_number}</div>
                      <div className="text-xs text-muted-foreground md:hidden">
                        {order.hospital_name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {order.hospital_name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={order.status === "draft" ? "secondary" : "default"}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>오늘 배송 예정</CardTitle>
            <CardDescription>
              오늘 배송될 주문 목록입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deliveriesRes.deliveries.length === 0 ? (
              <EmptyState icon={Truck} title="오늘 배송 예정이 없습니다." />
            ) : (
              <div className="space-y-3">
                 {deliveriesRes.deliveries.map((d) => (
                   <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                     <div>
                       <p className="text-sm font-medium">{d.order_number}</p>
                       <p className="text-xs text-muted-foreground">
                         {d.total_items}품목
                       </p>
                     </div>
                     <Badge variant="outline">배송예정</Badge>
                   </div>
                 ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 거래처별 주문 (30일)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {hospitals.length === 0 ? (
              <EmptyState icon={Building2} title="거래처 데이터가 없습니다." />
            ) : (
              <div className="space-y-3">
                {hospitals.slice(0, 5).map((h, i) => (
                  <div key={h.hospital_id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.hospital_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.order_count}건 / {h.item_count}품목
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {h.total_amount.toLocaleString("ko-KR")}원
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" /> 제품별 주문 (30일)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <EmptyState icon={Package} title="제품 데이터가 없습니다." />
            ) : (
              <div className="space-y-3">
                {products.slice(0, 5).map((p, i) => (
                  <div key={p.product_id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.order_count}건 / {p.total_quantity}개
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {p.total_amount.toLocaleString("ko-KR")}원
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
