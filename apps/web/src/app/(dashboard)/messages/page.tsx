import { getMessages, getMessagesForCalendar } from "@/lib/queries/messages";
import { getHospitals } from "@/lib/queries/hospitals";
import { getProductsCatalog } from "@/lib/queries/products";
import { getForecastsForCalendar } from "@/lib/queries/forecasts";
import { MessagesView } from "@/components/messages-view";
import { RealtimeListener } from "@/components/realtime-listener";
import { toLocalDateStr } from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

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
  const initialTab = params.tab === "calendar" ? "calendar" : "list";

  // --- List data ---
  const page = parseInt(params.page || "1", 10);
  const limit = 20;
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
  const [result, calendarMessages, hospitalsResult, productsResult, calendarForecasts] = await Promise.all([
    getMessages({ from: params.from, to: params.to, parse_status: params.parse_status, source_app: params.source_app, limit, offset })
      .catch(() => ({ messages: [], total: 0 })),
    getMessagesForCalendar({ from: fromStr, to: toStr }).catch(() => []),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
    getProductsCatalog().catch(() => []),
    getForecastsForCalendar({ from: fromStr, to: toStr }).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <>
      <RealtimeListener tables={["raw_messages", "captured_messages"]} />
      <MessagesView
        initialTab={initialTab}
        messages={result.messages}
        hospitals={hospitalsResult.hospitals}
        products={productsResult as any}
        currentPage={page}
        totalPages={totalPages}
        totalCount={result.total}
        calendarMessages={calendarMessages}
        calendarForecasts={calendarForecasts}
        initialCalView={calView}
        initialCalDate={calRef}
      />
    </>
  );
}
