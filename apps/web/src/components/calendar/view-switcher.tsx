"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import {
  formatWeekLabel,
  formatMonthLabel,
  formatDayLabel,
  getWeekMonday,
  type CalendarView,
} from "@/lib/schedule-utils";

interface ViewSwitcherProps {
  view: CalendarView;
  referenceDate: Date;
  onToggleSidePanel: () => void;
  children?: React.ReactNode;
}

export function ViewSwitcher({
  view,
  referenceDate,
  onToggleSidePanel,
  children,
}: ViewSwitcherProps) {
  const router = useRouter();

  function navigate(direction: -1 | 1) {
    if (view === "day") {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + direction);
      router.push(`/calendar?view=day&date=${d.toISOString().slice(0, 10)}`);
    } else if (view === "week") {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + direction * 7);
      router.push(`/calendar?view=week&week=${d.toISOString().slice(0, 10)}`);
    } else {
      const d = new Date(referenceDate);
      d.setMonth(d.getMonth() + direction);
      const param = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/calendar?view=month&month=${param}`);
    }
  }

  function goToday() {
    if (view === "day") {
      const d = new Date();
      router.push(`/calendar?view=day&date=${d.toISOString().slice(0, 10)}`);
    } else if (view === "week") {
      const mon = getWeekMonday(new Date());
      router.push(`/calendar?view=week&week=${mon.toISOString().slice(0, 10)}`);
    } else {
      const d = new Date();
      const param = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/calendar?view=month&month=${param}`);
    }
  }

  function switchView(newView: string) {
    if (newView === "day") {
      const d = view === "week" ? referenceDate : new Date();
      router.push(`/calendar?view=day&date=${d.toISOString().slice(0, 10)}`);
    } else if (newView === "week") {
      const mon = getWeekMonday(referenceDate);
      router.push(`/calendar?view=week&week=${mon.toISOString().slice(0, 10)}`);
    } else {
      const param = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/calendar?view=month&month=${param}`);
    }
  }

  const label =
    view === "day"
      ? formatDayLabel(referenceDate)
      : view === "month"
        ? formatMonthLabel(referenceDate)
        : formatWeekLabel(referenceDate);

  return (
    <div className="flex items-center gap-2 mb-3">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <h2 className="text-lg font-semibold whitespace-nowrap">{label}</h2>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={goToday}>
        오늘
      </Button>

      <Tabs value={view} onValueChange={switchView} className="ml-2">
        <TabsList className="h-8">
          <TabsTrigger value="day" className="text-xs px-3 h-7">일</TabsTrigger>
          <TabsTrigger value="week" className="text-xs px-3 h-7">주</TabsTrigger>
          <TabsTrigger value="month" className="text-xs px-3 h-7">월</TabsTrigger>
        </TabsList>
      </Tabs>

      {children}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 ml-auto"
        onClick={onToggleSidePanel}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
