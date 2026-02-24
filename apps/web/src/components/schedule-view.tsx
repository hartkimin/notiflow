"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClipboardPaste, CalendarPlus, Copy } from "lucide-react";
import {
  addAllCategoriesToWeek, copyPreviousWeekPlans, copyCurrentWeekToNext,
} from "@/lib/actions";
import type {
  MobileCategory, Plan, DayCategory, CapturedMessage, FilterRule,
} from "@/lib/types";
import type { CalendarView } from "@/lib/schedule-utils";

import { ViewSwitcher } from "@/components/calendar/view-switcher";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { CalendarSidePanel } from "@/components/calendar/side-panel";

interface ScheduleViewProps {
  categories: MobileCategory[];
  allCategories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  filterRules: FilterRule[];
  view: CalendarView;
  startMs: number;
  endMs: number;
  referenceDate: number; // epoch ms
}

export function ScheduleView({
  categories, allCategories, plans, dayCategories, messages, filterRules,
  view, startMs, endMs, referenceDate,
}: ScheduleViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const refDate = useMemo(() => new Date(referenceDate), [referenceDate]);

  // Week actions (only used in week view)
  function handleAddAllCategories() {
    startTransition(async () => {
      try {
        await addAllCategoriesToWeek(startMs);
        toast.success("전체 카테고리를 추가했습니다.");
        router.refresh();
      } catch { toast.error("카테고리 추가 실패"); }
    });
  }

  function handleCopyPrevWeek() {
    startTransition(async () => {
      try {
        await copyPreviousWeekPlans(startMs);
        toast.success("전주 플랜을 불러왔습니다.");
        router.refresh();
      } catch { toast.error("전주 복사 실패"); }
    });
  }

  function handleCopyToNext() {
    startTransition(async () => {
      try {
        await copyCurrentWeekToNext(startMs);
        toast.success("다음주로 복사했습니다.");
        router.refresh();
      } catch { toast.error("다음주 복사 실패"); }
    });
  }

  const weekActions = view === "week" ? (
    <div className="ml-auto flex items-center gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">전주 불러오기</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전주 플랜을 불러올까요?</AlertDialogTitle>
            <AlertDialogDescription>이전 주의 플랜과 카테고리가 현재 주로 복사됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyPrevWeek}>불러오기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
            <CalendarPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">전체 카테고리</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 카테고리를 추가할까요?</AlertDialogTitle>
            <AlertDialogDescription>모든 활성 카테고리를 이번 주 7일 모두에 추가합니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddAllCategories}>추가</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">다음주로 복사</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>다음주로 복사할까요?</AlertDialogTitle>
            <AlertDialogDescription>현재 주의 플랜과 카테고리가 다음 주로 복사됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyToNext}>복사</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <ViewSwitcher
        view={view}
        referenceDate={refDate}
        onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
      >
        {weekActions}
      </ViewSwitcher>

      {view === "week" && (
        <WeekView
          categories={categories}
          plans={plans}
          dayCategories={dayCategories}
          messages={messages}
          referenceDate={refDate}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      {view === "day" && (
        <DayView
          categories={categories}
          plans={plans}
          dayCategories={dayCategories}
          messages={messages}
          referenceDate={refDate}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      {view === "month" && (
        <MonthView
          categories={categories}
          plans={plans}
          dayCategories={dayCategories}
          messages={messages}
          referenceDate={refDate}
        />
      )}

      <CalendarSidePanel
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
        categories={allCategories}
        filterRules={filterRules}
      />
    </div>
  );
}
