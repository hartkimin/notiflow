import { getInvoices, getInvoiceStats, getInvoicesForCalendar, getLatestInvoiceDate } from "@/lib/queries/invoices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import InvoiceTable from "@/components/invoice-table";
import { Pagination } from "@/components/pagination";
import { ClientTabs } from "@/components/client-tabs";
import { toLocalDateStr } from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

const InvoiceCalendar = dynamic(
  () => import("@/components/invoice-calendar").then(m => ({ default: m.InvoiceCalendar })),
  { loading: () => <Skeleton className="h-[500px] w-full rounded-md" /> },
);

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    page?: string;
    from?: string;
    to?: string;
    month?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const initialTab = params.tab === "calendar" ? "calendar" : "list";
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;

  // Calendar month range
  let calYear: number, calMonth: number;
  if (params.month) {
    const parts = params.month.split("-").map(Number);
    calYear = parts[0]; calMonth = parts[1] - 1;
  } else {
    const latestDate = await getLatestInvoiceDate().catch(() => null);
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
  const calFrom = toLocalDateStr(new Date(calYear, calMonth, 1 - 7));
  const calTo = toLocalDateStr(new Date(calYear, calMonth + 1, 1 + 7));

  const [result, stats, calendarInvoices] = await Promise.all([
    getInvoices({
      status: status || undefined,
      from: params.from,
      to: params.to,
      limit,
      offset: (page - 1) * limit,
    }),
    getInvoiceStats({ from: params.from, to: params.to }).catch(() => null),
    getInvoicesForCalendar({ from: calFrom, to: calTo }).catch(() => []),
  ]);

  const totalPages = Math.ceil(result.total / limit);

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">세금계산서</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1" asChild>
            <Link href="/invoices/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">신규 발행</span>
            </Link>
          </Button>
        </div>
      </div>
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">전체</div>
              <div className="text-2xl font-bold">{stats.by_status.all.count}건</div>
              <div className="text-xs text-muted-foreground mt-1">₩{stats.by_status.all.total_amount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">임시 (초안)</div>
              <div className="text-2xl font-bold text-gray-600">{stats.by_status.draft.count}건</div>
              <div className="text-xs text-muted-foreground mt-1">₩{stats.by_status.draft.total_amount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">발행 완료</div>
              <div className="text-2xl font-bold text-green-600">{stats.by_status.issued.count}건</div>
              <div className="text-xs text-muted-foreground mt-1">₩{stats.by_status.issued.total_amount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">취소</div>
              <div className="text-2xl font-bold text-red-500">{stats.by_status.cancelled.count}건</div>
              <div className="text-xs text-muted-foreground mt-1">₩{stats.by_status.cancelled.total_amount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Link href="/invoices/new">
            <Card className="hover:border-orange-300 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">미발행 주문</div>
                <div className="text-2xl font-bold text-orange-600">{stats.unbilled_order_count}건</div>
                <div className="text-xs text-muted-foreground mt-1">클릭하여 발행 →</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <ClientTabs
        initialTab={initialTab}
        basePath="/invoices"
        tabs={[
          {
            value: "list",
            label: "목록",
            content: (
              <Tabs defaultValue={status || "all"}>
                <TabsList>
                  <TabsTrigger value="all" asChild><Link href="/invoices">전체</Link></TabsTrigger>
                  <TabsTrigger value="draft" asChild><Link href="/invoices?status=draft">임시</Link></TabsTrigger>
                  <TabsTrigger value="issued" asChild><Link href="/invoices?status=issued">발행</Link></TabsTrigger>
                  <TabsTrigger value="cancelled" asChild><Link href="/invoices?status=cancelled">취소</Link></TabsTrigger>
                </TabsList>
                <TabsContent value={status || "all"}>
                  <Card>
                    <CardContent className="p-0">
                      <InvoiceTable invoices={result.invoices} />
                    </CardContent>
                    {totalPages > 1 && (
                      <CardFooter>
                        <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
                      </CardFooter>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            ),
          },
          {
            value: "calendar",
            label: "캘린더",
            content: (
              <InvoiceCalendar initialView={calView} initialDate={calRef} invoices={calendarInvoices} />
            ),
          },
        ]}
      />
    </>
  );
}
