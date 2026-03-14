import { getMessages, getMessagesForCalendar } from "@/lib/queries/messages";
import { getHospitals } from "@/lib/queries/hospitals";
import { getProductsCatalog } from "@/lib/queries/products";
import { getForecastsForCalendar } from "@/lib/queries/forecasts";
import { parseCalendarParams, toLocalDateStr } from "@/lib/schedule-utils";
import { MessagesView } from "@/components/messages-view";
import { RealtimeListener } from "@/components/realtime-listener";

const PAGE_SIZE = 15;

interface Props {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    from?: string;
    to?: string;
    source?: string;
    view?: string;
    week?: string;
    date?: string;
    month?: string;
  }>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;

  const tab = params.tab === "calendar" ? "calendar" : "list";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Calendar params
  const calParams = parseCalendarParams({
    view: params.view,
    week: params.week,
    date: params.date,
    month: params.month,
  });
  const calFrom = toLocalDateStr(new Date(calParams.startMs));
  const calTo = toLocalDateStr(new Date(calParams.endMs));

  const [
    { messages, total: totalCount },
    hospitals,
    products,
    calendarMessages,
    calendarForecasts,
  ] = await Promise.all([
    getMessages({
      from: params.from,
      to: params.to,
      source_app: params.source,
      limit: PAGE_SIZE,
      offset,
    }).catch(() => ({ messages: [], total: 0 })),
    getHospitals({}).then((r) => r.hospitals).catch(() => []),
    getProductsCatalog().catch(() => []),
    getMessagesForCalendar({ from: calFrom, to: calTo }).catch(() => []),
    getForecastsForCalendar({ from: calFrom, to: calTo }).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <RealtimeListener tables={["captured_messages"]} />
      <MessagesView
        initialTab={tab as "list" | "calendar"}
        messages={messages}
        hospitals={hospitals}
        products={products}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        calendarMessages={calendarMessages}
        calendarForecasts={calendarForecasts}
        initialCalView={calParams.view}
        initialCalDate={calParams.referenceDate}
      />
    </>
  );
}
