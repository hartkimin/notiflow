import Link from "next/link";
import { PlusCircle, File } from "lucide-react";

import { getOrderItems, getOrdersForCalendar } from "@/lib/queries/orders";
import { getProducts } from "@/lib/queries/products";
import { getHospitals } from "@/lib/queries/hospitals";
import { getSuppliers } from "@/lib/queries/suppliers";
import { OrderTable } from "@/components/order-table";
import type { ProductOption } from "@/components/order-table";
import { OrderCalendar } from "@/components/order-calendar";
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
  }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialTab = params.tab === "calendar" ? "calendar" : "list";
  const page = parseInt(params.page || "1", 10);
  const status = params.status;
  const limit = 20;
  const offset = (page - 1) * limit;

  // Calendar month range
  let calYear: number, calMonth: number;
  if (params.month) {
    const parts = params.month.split("-").map(Number);
    calYear = parts[0]; calMonth = parts[1] - 1;
  } else {
    const now = new Date();
    calYear = now.getFullYear(); calMonth = now.getMonth();
  }
  const today = new Date();
  const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
  const calRef = isCurrentMonth ? today : new Date(calYear, calMonth, 1);
  const calView: CalendarView = (params.view === "day" || params.view === "month") ? params.view : "week";
  const fromStr = toLocalDateStr(new Date(calYear, calMonth, 1 - 7));
  const toStr = toLocalDateStr(new Date(calYear, calMonth + 1, 1 + 7));

  // Fetch both datasets in parallel for instant tab switching
  const [result, calendarOrders, { products: allProducts }, { hospitals: allHospitals }, { suppliers: allSuppliers }] = await Promise.all([
    getOrderItems({ status, from: params.from, to: params.to, limit, offset })
      .catch(() => ({ items: [], total: 0 })),
    getOrdersForCalendar({ from: fromStr, to: toStr }).catch(() => []),
    getProducts({ limit: 1000 }).catch(() => ({ products: [], total: 0 })),
    getHospitals({ limit: 1000 }).catch(() => ({ hospitals: [], total: 0 })),
    getSuppliers({ limit: 1000 }).catch(() => ({ suppliers: [], total: 0 })),
  ]);

  const productOptions: ProductOption[] = allProducts.map((p) => ({
    id: p.id, name: p.official_name,
  }));
  const hospitalOptions = allHospitals.map((h) => ({
    id: h.id, name: h.name,
  }));
  const supplierOptions = allSuppliers.map((s) => ({
    id: s.id, name: s.name,
  }));
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

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
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">주문 추가</span>
          </Button>
        </div>
      </div>

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
                  <TabsTrigger value="processing" asChild><Link href="/orders?status=processing">처리중</Link></TabsTrigger>
                  <TabsTrigger value="delivered" asChild><Link href="/orders?status=delivered">배송완료</Link></TabsTrigger>
                </TabsList>
                <TabsContent value={status || "all"}>
                  <Card>
                    <CardHeader>
                      <CardTitle>주문 목록</CardTitle>
                      <CardDescription><OrderFilters /></CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OrderTable items={result.items} products={productOptions} hospitals={hospitalOptions} suppliers={supplierOptions} />
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
              <OrderCalendar orders={calendarOrders} initialView={calView} initialDate={calRef} />
            ),
          },
        ]}
      />
    </>
  );
}
