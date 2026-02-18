import { ScheduleView } from "@/components/schedule-view";
import { RealtimeListener } from "@/components/realtime-listener";
import {
  getCategories,
  getWeekPlans,
  getWeekDayCategories,
  getWeekMessages,
} from "@/lib/queries/schedule";
import { parseWeekParam, startOfDayMs } from "@/lib/schedule-utils";

interface Props {
  searchParams: Promise<{ week?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const monday = parseWeekParam(params.week);
  const weekStartMs = startOfDayMs(monday);

  const [categories, plans, dayCategories, messages] = await Promise.all([
    getCategories().catch(() => []),
    getWeekPlans(weekStartMs).catch(() => []),
    getWeekDayCategories(weekStartMs).catch(() => []),
    getWeekMessages(weekStartMs).catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full">
      <RealtimeListener
        tables={["categories", "plans", "day_categories", "captured_messages"]}
      />
      <ScheduleView
        categories={categories}
        plans={plans}
        dayCategories={dayCategories}
        messages={messages}
        weekStartMs={weekStartMs}
      />
    </div>
  );
}
