import Link from "next/link";
import { File, PlusCircle } from "lucide-react";

import { getOrderItems, getOrderSummaryStats, getLatestOrderDate, getOrdersForCalendar } from "@/lib/queries/orders";
import { getProductsCatalog } from "@/lib/queries/products";
import { getOrderDisplayColumns } from "@/lib/queries/settings";
import { getMessageById } from "@/lib/queries/messages";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const OrderTable = dynamic(
  () => import("@/components/order-table").then(m => ({ default: m.OrderTable })),
  { loading: () => <Skeleton className="h-[400px] w-full rounded-md" /> },
);
const OrderCalendar = dynamic(
  () => import("@/components/order-calendar").then(m => ({ default: m.OrderCalendar })),
  { loading: () => <Skeleton className="h-[500px] w-full rounded-md" /> },
);

import type { ProductOption } from "@/components/order-table";
import { OrderFilters } from "@/components/order-filters";
import { Pagination } from "@/components/pagination";
import { ClientTabs } from "@/components/client-tabs";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealtimeListener } from "@/components/realtime-listener";
import { toLocalDateStr } from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

interface Props {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    view?: string;
    month?: string;
    create_from_message?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialTab = params.tab === "calendar" ? "calendar" : "list";
  const page = parseInt(params.page || "1", 10);
  const status = params.status;
  const limit = 15;
  const offset = (page - 1) * limit;

  // Calendar month range — default to latest order month (not current month)
  let calYear: number, calMonth: number;
  if (params.month) {
    const parts = params.month.split("-").map(Number);
    calYear = parts[0]; calMonth = parts[1] - 1;
  } else {
    const latestDate = await getLatestOrderDate().catch(() => null);
    if (latestDate) {
      const parts = latestDate.split("-").map(Number);
      calYear = parts[0]; calMonth = parts[1] - 1;
    } else {
      const now = new Date();
      calYear = now.getFullYear(); calMonth = now.getMonth();
    }
  }
  const today = new Date();
  const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
  const calRef = isCurrentMonth ? today : new Date(calYear, calMonth, 1);
  const calView: CalendarView = (params.view === "day" || params.view === "month") ? params.view : "week";
  const fromStr = toLocalDateStr(new Date(calYear, calMonth, 1 - 7));
  const toStr = toLocalDateStr(new Date(calYear, calMonth + 1, 1 + 7));

  const messagePromise = params.create_from_message
    ? getMessageById(params.create_from_message)
    : Promise.resolve(null);

  const [result, allProducts, displayColumns, sourceMessage, orderStats, calendarOrders] = await Promise.all([
    getOrderItems({ status, from: params.from, to: params.to, limit, offset })
      .catch(() => ({ items: [], total: 0 })),
    getProductsCatalog().catch(() => []),
    getOrderDisplayColumns(),
    messagePromise,
    getOrderSummaryStats({ status, from: params.from, to: params.to }).catch(() => null),
    getOrdersForCalendar({ from: fromStr, to: toStr }).catch(() => []),
  ]);

  const productOptions: ProductOption[] = allProducts.map((p) => ({
    id: p.id, name: p.official_name,
  }));
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  const initialMessageContent = sourceMessage?.content;
  const sourceMessageId = sourceMessage?.id?.toString();

  return (
    <>
      <RealtimeListener tables={["orders", "order_items"]} />
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">주문 관리</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">내보내기</span>
          </Button>
          <Button size="sm" className="h-8 gap-1" asChild>
            <Link href={sourceMessageId ? `/orders/new?source_message_id=${sourceMessageId}` : "/orders/new"}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">주문 추가</span>
            </Link>
          </Button>
        </div>
      </div>

      {orderStats && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-6 overflow-x-auto text-sm">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">전체</span>
                <span className="font-bold">{orderStats.total_count}건</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">접수</span>
                <span className="font-bold text-blue-600">{orderStats.status_counts.confirmed ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">배송완료</span>
                <span className="font-bold">{orderStats.status_counts.delivered ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">발행완료</span>
                <span className="font-bold text-green-600">{orderStats.status_counts.invoiced ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">취소</span>
                <span className="font-bold text-red-500">{orderStats.status_counts.cancelled ?? 0}</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">매입</span>
                <span className="font-bold">₩{orderStats.total_purchase_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">매출</span>
                <span className="font-bold">₩{orderStats.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">이익</span>
                <span className={`font-bold ${orderStats.total_profit < 0 ? "text-red-500" : "text-green-600"}`}>
                  ₩{orderStats.total_profit.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">이익률</span>
                <span className={`font-bold ${orderStats.profit_margin < 0 ? "text-red-500" : ""}`}>
                  {orderStats.profit_margin.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ClientTabs
        initialTab={initialTab}
        basePath="/orders"
        tabs={[
          {
            value: "list",
            label: "목록",
            content: (
              <Tabs defaultValue={status || "all"}>
                <TabsList>
                  <TabsTrigger value="all" asChild><Link href="/orders">전체</Link></TabsTrigger>
                  <TabsTrigger value="confirmed" asChild><Link href="/orders?status=confirmed">확인됨</Link></TabsTrigger>
                  <TabsTrigger value="delivered" asChild><Link href="/orders?status=delivered">배송완료</Link></TabsTrigger>
                  <TabsTrigger value="invoiced" asChild><Link href="/orders?status=invoiced">세금계산서발행</Link></TabsTrigger>
                </TabsList>
                <TabsContent value={status || "all"}>
                  <Card>
                    <CardHeader>
                      <CardTitle>주문 목록</CardTitle>
                      <CardDescription><OrderFilters /></CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OrderTable items={result.items} products={productOptions} />
                    </CardContent>
                    <CardFooter>
                      <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            ),
          },
          {
            value: "calendar",
            label: "캘린더",
            content: (
              <OrderCalendar calendarFrom={fromStr} calendarTo={toStr} initialView={calView} initialDate={calRef} initialOrders={calendarOrders} />
            ),
          },
        ]}
      />
    </>
  );
}
