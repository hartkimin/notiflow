import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { OrderExportButton } from "@/components/order-export-button";

import { getOrderItems, getOrderSummaryStats, getLatestOrderDate } from "@/lib/queries/orders";
import { getHospitals } from "@/lib/queries/hospitals";
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { RealtimeListener } from "@/components/realtime-listener";
import { toLocalDateStr } from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

interface Props {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    hospital?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: string;
    size?: string;
    view?: string;
    month?: string;
    vat?: string;
    invoice?: string;
    create_from_message?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialTab = params.tab === "calendar" ? "calendar" : "list";
  const page = parseInt(params.page || "1", 10);
  const limit = parseInt(params.size || "15", 10);
  const offset = (page - 1) * limit;
  const status = params.status;
  const hospitalId = params.hospital ? parseInt(params.hospital, 10) : undefined;
  const search = params.search;
  // Calendar month range
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

  // Get invoiced order IDs (needed early for invoice filter)
  const { createClient: createSC } = await import("@/lib/supabase/server");
  const sbInvoice = await createSC();
  const { data: invoicedLinks } = await sbInvoice
    .from("tax_invoice_orders")
    .select("order_id, tax_invoices!inner(status)")
    .neq("tax_invoices.status", "cancelled");
  const invoicedOrderIds = new Set((invoicedLinks ?? []).map(l => l.order_id));

  // Build invoice filter order IDs
  const invoiceFilter = params.invoice; // "issued" | "not_issued" | undefined
  let invoiceFilterIds: number[] | undefined;
  if (invoiceFilter === "issued") {
    invoiceFilterIds = [...invoicedOrderIds];
  } else if (invoiceFilter === "not_issued") {
    // Will be applied post-query as exclusion set
    invoiceFilterIds = undefined;
  }

  const [result, allProducts, , sourceMessage, orderStats, { hospitals }] = await Promise.all([
    getOrderItems({ status, hospital_id: hospitalId, search, from: params.from, to: params.to, limit, offset, order_ids: invoiceFilterIds, exclude_order_ids: invoiceFilter === "not_issued" ? [...invoicedOrderIds] : undefined })
      .catch(() => ({ items: [], total: 0 })),
    getProductsCatalog().catch(() => []),
    getOrderDisplayColumns(),
    messagePromise,
    getOrderSummaryStats({ status, hospital_id: hospitalId, from: params.from, to: params.to }).catch(() => null),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
  ]);

  const productOptions: ProductOption[] = allProducts.map((p) => ({
    id: p.id, name: p.official_name,
  }));
  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  const sourceMessageId = sourceMessage?.id?.toString();

  const hospitalOptions = hospitals.map((h) => ({ id: h.id, name: h.name }));

  return (
    <>
      <RealtimeListener tables={["orders", "order_items"]} />

      {/* Stats bar — mobile: 매입/매출/이익 3열, desktop: full stats */}
      {orderStats && (
        <Card>
          <CardContent className="p-3">
            {/* Mobile: 3-column grid */}
            <div className="grid grid-cols-3 gap-3 md:hidden text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">매입</p>
                <p className="text-sm font-bold">₩{(orderStats.total_purchase_amount / 10000).toFixed(0)}만</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">매출</p>
                <p className="text-sm font-bold">₩{(orderStats.total_supply_amount / 10000).toFixed(0)}만</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">이익 ({orderStats.profit_margin.toFixed(1)}%)</p>
                <p className={`text-sm font-bold ${orderStats.total_profit < 0 ? "text-red-500" : "text-green-600"}`}>
                  ₩{(orderStats.total_profit / 10000).toFixed(0)}만
                </p>
              </div>
            </div>
            {/* Desktop: full inline stats */}
            <div className="hidden md:flex items-center gap-6 overflow-x-auto text-sm">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">전체</span>
                <span className="font-bold">{orderStats.total_count}건</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">미완료</span>
                <span className="font-bold text-blue-600">{orderStats.status_counts.confirmed ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">완료</span>
                <span className="font-bold text-green-600">{orderStats.status_counts.delivered ?? 0}</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">매입(VAT포함)</span>
                <span className="font-bold">₩{orderStats.total_purchase_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">매출(VAT포함)</span>
                <span className="font-bold">₩{orderStats.total_supply_amount.toLocaleString()}</span>
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

      {/* Compact header: Title | Tabs | Filters | Actions — all in 1 row */}
      <ClientTabs
        initialTab={initialTab}
        basePath="/orders"
        toolbarLeft={
          <h1 className="text-base font-semibold shrink-0">주문 관리</h1>
        }
        toolbarRight={
          <div className="flex items-center gap-1.5 ml-auto">
            <OrderFilters hospitals={hospitalOptions} />
            <div className="h-4 w-px bg-border shrink-0" />
            <OrderExportButton params={{
              status: params.status,
              hospital_id: params.hospital,
              from: params.from,
              to: params.to,
              search: params.search,
            }} />
            <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" asChild>
              <Link href={sourceMessageId ? `/orders/new?source_message_id=${sourceMessageId}` : "/orders/new"}>
                <PlusCircle className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        }
        tabs={[
          {
            value: "list",
            label: "목록",
            content: (
              <Card>
                <CardContent className="p-0">
                  <OrderTable items={result.items} products={productOptions} invoicedOrderIds={invoicedOrderIds} />
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-xs text-muted-foreground">
                    총 {result.total}건 중 {offset + 1}~{Math.min(offset + limit, result.total)}건
                  </span>
                  <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
                </CardFooter>
              </Card>
            ),
          },
          {
            value: "calendar",
            label: "캘린더",
            content: (
              <OrderCalendar initialView={calView} initialDate={calRef} calendarFrom={fromStr} calendarTo={toStr} />
            ),
          },
        ]}
      />
    </>
  );
}
