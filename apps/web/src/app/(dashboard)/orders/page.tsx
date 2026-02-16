import Link from "next/link";
import { PlusCircle, File } from "lucide-react";

import { getOrders } from "@/lib/queries/orders";
import { OrderTable } from "@/components/order-table";
import { OrderFilters } from "@/components/order-filters";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Props {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status;
  const limit = 20;
  const offset = (page - 1) * limit;

  const result = await getOrders({
    status: status,
    from: params.from,
    to: params.to,
    limit,
    offset,
  }).catch(() => ({ orders: [], total: 0 }));

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">주문 관리</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              내보내기
            </span>
          </Button>
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              주문 추가
            </span>
          </Button>
        </div>
      </div>
      <Tabs defaultValue={status || "all"}>
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all" asChild><Link href="/orders">전체</Link></TabsTrigger>
            <TabsTrigger value="confirmed" asChild><Link href="/orders?status=confirmed">확인됨</Link></TabsTrigger>
            <TabsTrigger value="processing" asChild><Link href="/orders?status=processing">처리중</Link></TabsTrigger>
            <TabsTrigger value="delivered" asChild><Link href="/orders?status=delivered">배송완료</Link></TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={status || "all"}>
          <Card>
            <CardHeader>
              <CardTitle>주문 목록</CardTitle>
              <CardDescription>
                <OrderFilters />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable orders={result.orders} />
            </CardContent>
            <CardFooter>
              <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
