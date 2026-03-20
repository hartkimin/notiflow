import { getInvoices, getInvoiceStats } from "@/lib/queries/invoices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import InvoiceTable from "@/components/invoice-table";
import { Pagination } from "@/components/pagination";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;

  const [result, stats] = await Promise.all([
    getInvoices({
      status: status || undefined,
      from: params.from,
      to: params.to,
      limit,
      offset: (page - 1) * limit,
    }),
    getInvoiceStats({ from: params.from, to: params.to }).catch(() => null),
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">전체</div>
              <div className="text-2xl font-bold">{stats.total_count}건</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">발행 완료</div>
              <div className="text-2xl font-bold">{stats.issued_count}건</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">합계 금액</div>
              <div className="text-2xl font-bold">₩{stats.total_amount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">미발행 주문</div>
              <div className="text-2xl font-bold text-orange-600">{stats.unbilled_order_count}건</div>
            </CardContent>
          </Card>
        </div>
      )}
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
    </>
  );
}
