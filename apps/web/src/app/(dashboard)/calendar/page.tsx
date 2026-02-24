import { ScheduleView } from "@/components/schedule-view";
import { RealtimeListener } from "@/components/realtime-listener";
import {
  getCategories,
  getPlans,
  getDayCategories,
  getMessages,
  getFilterRules,
} from "@/lib/queries/schedule";
import { parseCalendarParams } from "@/lib/schedule-utils";

interface Props {
  searchParams: Promise<{
    view?: string;
    week?: string;
    date?: string;
    month?: string;
  }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const calendarParams = parseCalendarParams(params);
  const { view, startMs, endMs } = calendarParams;

  const [categories, plans, dayCategories, messages, filterRules] =
    await Promise.all([
      getCategories().catch(() => []),
      getPlans(startMs, endMs).catch(() => []),
      getDayCategories(startMs, endMs).catch(() => []),
      getMessages(startMs, endMs).catch(() => []),
      getFilterRules().catch(() => []),
    ]);

  return (
    <div className="flex flex-col h-full">
      <RealtimeListener
        tables={[
          "categories",
          "plans",
          "day_categories",
          "captured_messages",
          "filter_rules",
        ]}
      />
      <ScheduleView
        categories={categories}
        plans={plans}
        dayCategories={dayCategories}
        messages={messages}
        filterRules={filterRules}
        view={view}
        startMs={startMs}
        endMs={endMs}
        referenceDate={calendarParams.referenceDate.getTime()}
      />
    </div>
  );
}
