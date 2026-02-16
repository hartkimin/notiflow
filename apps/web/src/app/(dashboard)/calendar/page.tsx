import { getCalendarStats } from "@/lib/queries/stats";
import { getOrders } from "@/lib/queries/orders";
import { getMessages } from "@/lib/queries/messages";
import { OrderCalendar } from "@/components/order-calendar";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const month = params.month || format(new Date(), "yyyy-MM");
  const monthDate = new Date(month + "-01T00:00:00");
  
  const from = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const to = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const [calendarData, ordersData, messagesData] = await Promise.all([
    getCalendarStats(month).catch(() => ({ month, days: [] })),
    getOrders({ from, to, limit: 300 }).catch(() => ({ orders: [], total: 0 })),
    getMessages({ from, to, limit: 300 }).catch(() => ({ messages: [], total: 0 })),
  ]);

  const prevMonth = format(subMonths(monthDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center pb-4">
        <h1 className="text-lg font-semibold md:text-2xl">캘린더 ({month})</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendar?month=${prevMonth}`}>
              <ChevronLeft className="h-4 w-4" />
              이전 달
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendar?month=${nextMonth}`}>
              다음 달
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex-1 rounded-md border overflow-hidden">
        <OrderCalendar
          month={month}
          days={calendarData.days}
          orders={ordersData.orders}
          messages={messagesData.messages}
        />
      </div>
    </div>
  );
}
