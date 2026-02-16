import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  CheckCircle,
  Truck,
  Shield,
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
import { getDailyStats } from "@/lib/queries/stats";
import { getOrders } from "@/lib/queries/orders";
import { getTodayDeliveries } from "@/lib/queries/deliveries";
import { getPendingKpis } from "@/lib/queries/reports";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

export default async function DashboardHome() {
  const [stats, ordersRes, deliveriesRes, kpisRes] = await Promise.all([
    getDailyStats().catch(() => ({
      date: "",
      total_messages: 0,
      parse_success: 0,
      orders_created: 0,
      parse_success_rate: 0,
    })),
    getOrders({ limit: 5 }).catch(() => ({ orders: [], total: 0 })),
    getTodayDeliveries().catch(() => ({ count: 0, deliveries: [] })),
    getPendingKpis().catch(() => ({ count: 0, reports: [] })),
  ]);

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">대시보드</h1>
        <div className="ml-auto flex items-center gap-2">
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
          title="오늘 주문"
          value={`${stats.orders_created}건`}
          description={`메시지 ${stats.total_messages}건 수신`}
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          title="파싱 성공률"
          value={`${stats.parse_success_rate}%`}
          description={`${stats.parse_success}/${stats.total_messages}건 성공`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="오늘 배송"
          value={`${deliveriesRes.count}건`}
          description="배송 예정"
          icon={Truck}
          color="amber"
        />
        <StatCard
          title="KPIS 미신고"
          value={`${kpisRes.count}건`}
          description="신고 대기중"
          icon={Shield}
          color="red"
        />
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
              // This can also be a table if more details are needed
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
    </>
  );
}
