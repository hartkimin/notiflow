export const dynamic = "force-dynamic";

import { getMessages, getLinkedOrders } from "@/lib/queries/messages";
import { getHospitals } from "@/lib/queries/hospitals";
import { getProductsCatalog } from "@/lib/queries/products";
import { MessagesView } from "@/components/messages-view";
import { RealtimeListener } from "@/components/realtime-listener";
import { toLocalDateStr } from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";
import type { Product } from "@/lib/types";

interface Props {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    source_app?: string;
    page?: string;
    view?: string;
    month?: string;
    q?: string;
  }>;
}

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialTab = params.tab === "calendar" ? "calendar" : "list";

  // --- List data ---
  const page = parseInt(params.page || "1", 10);
  const limit = 15;
  const offset = (page - 1) * limit;

  // --- Calendar month range ---
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
  const [result, hospitalsResult, productsResult] = await Promise.all([
    getMessages({ from: params.from, to: params.to, source_app: params.source_app, q: params.q, limit, offset })
      .catch(() => ({ messages: [], total: 0 })),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
    getProductsCatalog().catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  // Fetch linked orders for displayed messages
  const messageIds = result.messages.map((m) => m.id);
  const linkedOrders = await getLinkedOrders(messageIds).catch(() => ({}));

  return (
    <>
      <RealtimeListener tables={["captured_messages"]} />
      <MessagesView
        initialTab={initialTab}
        messages={result.messages}
        linkedOrders={linkedOrders}
        hospitals={hospitalsResult.hospitals}
        products={productsResult as Product[]}
        currentPage={page}
        totalPages={totalPages}
        totalCount={result.total}
        calendarStartMs={new Date(fromStr).getTime()}
        calendarEndMs={new Date(toStr).getTime()}
        calendarFrom={fromStr}
        calendarTo={toStr}
        initialCalView={calView}
        initialCalDate={calRef}
      />
    </>
  );
}
