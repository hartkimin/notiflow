import { getMessages } from "@/lib/queries/messages";
import { getHospitals } from "@/lib/queries/hospitals";
import { getProducts } from "@/lib/queries/products";
import { MessageFilters, MessageTable, CreateMessageDialog } from "@/components/message-list";
import { Pagination } from "@/components/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RealtimeListener } from "@/components/realtime-listener";

interface Props {
  searchParams: Promise<{
    from?: string;
    to?: string;
    parse_status?: string;
    source_app?: string;
    page?: string;
  }>;
}

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [result, hospitalsResult, productsResult] = await Promise.all([
    getMessages({
      from: params.from,
      to: params.to,
      parse_status: params.parse_status,
      source_app: params.source_app,
      limit,
      offset,
    }).catch(() => ({ messages: [], total: 0 })),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
    getProducts({ limit: 500 }).catch(() => ({ products: [], total: 0 })),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <>
      <RealtimeListener tables={["raw_messages", "captured_messages"]} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">수신메시지</h1>
        <CreateMessageDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>메시지 목록</CardTitle>
          <CardDescription>
            <MessageFilters />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessageTable
            messages={result.messages}
            hospitals={hospitalsResult.hospitals}
            products={productsResult.products}
          />
        </CardContent>
        <CardFooter>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={result.total}
          />
        </CardFooter>
      </Card>
    </>
  );
}
