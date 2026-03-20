import { getInvoices, getInvoiceStats, getInvoicesForCalendar, getLatestInvoiceDate } from "@/lib/queries/invoices";
import { getHospitals } from "@/lib/queries/hospitals";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import InvoiceTable from "@/components/invoice-table";
import { InvoiceFilters } from "@/components/invoice-filters";
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
    hospital?: string;
    search?: string;
    page?: string;
    from?: string;
    to?: string;
    size?: string;
    month?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const initialTab = params.tab === "calendar" ? "calendar" : "list";
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);
  const limit = parseInt(params.size || "25", 10);
  const offset = (page - 1) * limit;
  const hospitalId = params.hospital ? parseInt(params.hospital, 10) : undefined;
  const search = params.search;

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

  const [result, stats, calendarInvoices, { hospitals }] = await Promise.all([
    getInvoices({
      status: status || undefined,
      hospital_id: hospitalId,
      search,
      from: params.from,
      to: params.to,
      limit,
      offset,
    }),
    getInvoiceStats({ from: params.from, to: params.to }).catch(() => null),
    getInvoicesForCalendar({ from: calFrom, to: calTo }).catch(() => []),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
  ]);

  const totalPages = Math.ceil(result.total / limit);
  const hospitalOptions = hospitals.map((h) => ({ id: h.id, name: h.name }));

  return (
    <>
      {/* Header */}
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

      {/* Stats bar */}
      {stats && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-6 overflow-x-auto text-sm">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">전체</span>
                <span className="font-bold">{stats.by_status.all.count}건</span>
                <span className="text-xs text-muted-foreground">₩{stats.by_status.all.total_amount.toLocaleString()}</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">임시</span>
                <span className="font-bold text-gray-600">{stats.by_status.draft.count}건</span>
                <span className="text-xs text-muted-foreground">₩{stats.by_status.draft.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">발행</span>
                <span className="font-bold text-green-600">{stats.by_status.issued.count}건</span>
                <span className="text-xs text-muted-foreground">₩{stats.by_status.issued.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">취소</span>
                <span className="font-bold text-red-500">{stats.by_status.cancelled.count}건</span>
                <span className="text-xs text-muted-foreground">₩{stats.by_status.cancelled.total_amount.toLocaleString()}</span>
              </div>
              <div className="h-4 w-px bg-border shrink-0" />
              <Link href="/invoices/new" className="flex items-center gap-1.5 shrink-0 hover:underline">
                <span className="text-muted-foreground">미발행 주문</span>
                <span className="font-bold text-orange-600">{stats.unbilled_order_count}건</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: list / calendar */}
      <ClientTabs
        initialTab={initialTab}
        basePath="/invoices"
        tabs={[
          {
            value: "list",
            label: "목록",
            content: (
              <div className="space-y-3">
                <InvoiceFilters hospitals={hospitalOptions} />
                <Card>
                  <CardContent className="p-0">
                    <InvoiceTable invoices={result.invoices} />
                  </CardContent>
                  <CardFooter className="justify-between">
                    <span className="text-xs text-muted-foreground">
                      총 {result.total}건 중 {result.total > 0 ? offset + 1 : 0}~{Math.min(offset + limit, result.total)}건
                    </span>
                    <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
                  </CardFooter>
                </Card>
              </div>
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
