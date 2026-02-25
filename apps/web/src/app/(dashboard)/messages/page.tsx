import { getMessages, getMessagesForCalendar } from "@/lib/queries/messages";
import { getHospitals } from "@/lib/queries/hospitals";
import { getProducts } from "@/lib/queries/products";
import { MessageFilters, MessageTable, CreateMessageDialog } from "@/components/message-list";
import { MessageCalendar } from "@/components/message-calendar";
import { Pagination } from "@/components/pagination";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealtimeListener } from "@/components/realtime-listener";
import { toLocalDateStr } from "@/lib/schedule-utils";
import type { RawMessage } from "@/lib/types";
import type { CalendarView } from "@/lib/schedule-utils";
import Link from "next/link";

interface Props {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    parse_status?: string;
    source_app?: string;
    page?: string;
    view?: string;
    month?: string;
  }>;
}

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "calendar" ? "calendar" : "list";

  // --- List view data ---
  const page = parseInt(params.page || "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [result, hospitalsResult, productsResult] = await Promise.all([
    tab === "list"
      ? getMessages({ from: params.from, to: params.to, parse_status: params.parse_status, source_app: params.source_app, limit, offset })
          .catch(() => ({ messages: [], total: 0 }))
      : Promise.resolve({ messages: [], total: 0 }),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
    getProducts({ limit: 500 }).catch(() => ({ products: [], total: 0 })),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  // --- Calendar: always fetch full month (with ±7 day padding for edge weeks) ---
  let calendarMessages: RawMessage[] = [];
  let calView: CalendarView = "week";
  let calRef = new Date();

  if (tab === "calendar") {
    let year: number, month: number;
    if (params.month) {
      const parts = params.month.split("-").map(Number);
      year = parts[0]; month = parts[1] - 1;
    } else {
      const now = new Date();
      year = now.getFullYear(); month = now.getMonth();
    }
    calRef = new Date(year, month, 1);
    calView = (params.view === "day" || params.view === "month") ? params.view : "week";
    const fromStr = toLocalDateStr(new Date(year, month, 1 - 7));
    const toStr = toLocalDateStr(new Date(year, month + 1, 1 + 7));
    calendarMessages = await getMessagesForCalendar({ from: fromStr, to: toStr }).catch(() => []);
  }

  return (
    <>
      <RealtimeListener tables={["raw_messages", "captured_messages"]} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">수신메시지</h1>
        {tab === "list" && <CreateMessageDialog />}
      </div>

      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="list" asChild>
            <Link href="/messages">목록</Link>
          </TabsTrigger>
          <TabsTrigger value="calendar" asChild>
            <Link href="/messages?tab=calendar">캘린더</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>메시지 목록</CardTitle>
              <CardDescription><MessageFilters /></CardDescription>
            </CardHeader>
            <CardContent>
              <MessageTable messages={result.messages} hospitals={hospitalsResult.hospitals} products={productsResult.products} />
            </CardContent>
            <CardFooter>
              <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <MessageCalendar messages={calendarMessages} initialView={calView} initialDate={calRef} />
        </TabsContent>
      </Tabs>
    </>
  );
}
