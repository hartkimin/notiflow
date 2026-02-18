"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft, ChevronRight, Plus, X, Link2, Hash, Trash2,
  Copy, ClipboardPaste, CalendarPlus, MessageSquare, Calendar,
} from "lucide-react";
import {
  createPlan, togglePlanCompletion, deletePlan, linkPlanToMessage,
  updatePlanOrderNumber, addCategoryToDay, removeCategoryFromDay,
  addAllCategoriesToWeek, copyPreviousWeekPlans, copyCurrentWeekToNext,
} from "@/lib/actions";
import {
  getWeekMonday, getWeekDates, startOfDayMs, argbToHex,
  formatWeekLabel, formatEpochTime,
} from "@/lib/schedule-utils";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────

interface ScheduleViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  weekStartMs: number;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// ─── Main Component ────────────────────────────────────────────

export function ScheduleView({
  categories, plans, dayCategories, messages, weekStartMs,
}: ScheduleViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const monday = useMemo(() => new Date(weekStartMs), [weekStartMs]);
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);

  // Group data by day (epoch ms at start of day)
  const plansByDay = useMemo(() => {
    const map = new Map<number, Plan[]>();
    for (const p of plans) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return map;
  }, [plans]);

  const dayCatsByDay = useMemo(() => {
    const map = new Map<number, DayCategory[]>();
    for (const dc of dayCategories) map.set(dc.date, [...(map.get(dc.date) ?? []), dc]);
    return map;
  }, [dayCategories]);

  const messagesByDay = useMemo(() => {
    const map = new Map<number, CapturedMessage[]>();
    for (const m of messages) {
      const dayMs = startOfDayMs(new Date(m.received_at));
      map.set(dayMs, [...(map.get(dayMs) ?? []), m]);
    }
    return map;
  }, [messages]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Navigation
  function navigateWeek(offset: number) {
    const target = new Date(monday);
    target.setDate(target.getDate() + offset * 7);
    const param = target.toISOString().slice(0, 10);
    router.push(`/calendar?week=${param}`);
  }

  function navigateToWeekOf(date: Date) {
    const mon = getWeekMonday(date);
    const param = mon.toISOString().slice(0, 10);
    router.push(`/calendar?week=${param}`);
  }

  // Week actions
  function handleAddAllCategories() {
    startTransition(async () => {
      try {
        await addAllCategoriesToWeek(weekStartMs);
        toast.success("전체 카테고리를 추가했습니다.");
        router.refresh();
      } catch { toast.error("카테고리 추가 실패"); }
    });
  }

  function handleCopyPrevWeek() {
    startTransition(async () => {
      try {
        await copyPreviousWeekPlans(weekStartMs);
        toast.success("전주 플랜을 불러왔습니다.");
        router.refresh();
      } catch { toast.error("전주 복사 실패"); }
    });
  }

  function handleCopyToNext() {
    startTransition(async () => {
      try {
        await copyCurrentWeekToNext(weekStartMs);
        toast.success("다음주로 복사했습니다.");
        router.refresh();
      } catch { toast.error("다음주 복사 실패"); }
    });
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 shrink-0 space-y-4 overflow-y-auto">
        <MiniCalendar
          currentMonday={monday}
          onSelectWeek={navigateToWeekOf}
        />

        <Card>
          <CardContent className="p-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">카테고리</h3>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">카테고리가 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: argbToHex(c.color) }}
                    />
                    <span className="truncate">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주간 작업</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled={isPending}>
                  <ClipboardPaste className="h-3.5 w-3.5" /> 전주 불러오기
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
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled={isPending}>
                  <CalendarPlus className="h-3.5 w-3.5" /> 전체 카테고리 추가
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
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled={isPending}>
                  <Copy className="h-3.5 w-3.5" /> 다음주로 복사
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
          </CardContent>
        </Card>
      </aside>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Week Header */}
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold whitespace-nowrap">
            {formatWeekLabel(monday)}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => navigateToWeekOf(new Date())}
          >
            오늘
          </Button>
        </div>

        {/* Day Columns */}
        <div className="grid grid-cols-7 gap-2 flex-1 min-h-0 overflow-y-auto">
          {weekDates.map((date, i) => {
            const dayMs = startOfDayMs(date);
            const isToday = startOfDayMs(new Date()) === dayMs;
            const isSaturday = i === 5;
            const isSunday = i === 6;

            return (
              <DayColumn
                key={dayMs}
                date={date}
                dayMs={dayMs}
                dayLabel={DAY_LABELS[i]}
                isToday={isToday}
                isSaturday={isSaturday}
                isSunday={isSunday}
                categories={categories}
                categoryMap={categoryMap}
                dayCategories={dayCatsByDay.get(dayMs) ?? []}
                plans={plansByDay.get(dayMs) ?? []}
                messages={messagesByDay.get(dayMs) ?? []}
                isPending={isPending}
                startTransition={startTransition}
                router={router}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Mini Calendar ─────────────────────────────────────────────

function MiniCalendar({
  currentMonday,
  onSelectWeek,
}: {
  currentMonday: Date;
  onSelectWeek: (date: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    return new Date(currentMonday.getFullYear(), currentMonday.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Build 6-week grid
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const todayMs = startOfDayMs(new Date());
  const currentWeekMs = startOfDayMs(currentMonday);

  function prevMonth() { setViewMonth(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewMonth(new Date(year, month + 1, 1)); }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevMonth}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-sm font-medium">{year}년 {month + 1}월</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextMonth}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0 text-center">
          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
            <div key={d} className="text-[10px] text-muted-foreground font-medium py-1">{d}</div>
          ))}
          {days.map((d, i) => {
            const dMs = startOfDayMs(d);
            const isCurrentMonth = d.getMonth() === month;
            const isToday = dMs === todayMs;
            const dayMonday = getWeekMonday(d);
            const isSelectedWeek = startOfDayMs(dayMonday) === currentWeekMs;

            return (
              <button
                key={i}
                onClick={() => onSelectWeek(d)}
                className={[
                  "text-[11px] py-0.5 rounded transition-colors",
                  !isCurrentMonth && "text-muted-foreground/40",
                  isSelectedWeek && "bg-primary/10",
                  isToday && "font-bold text-primary",
                  "hover:bg-muted",
                ].filter(Boolean).join(" ")}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Day Column ────────────────────────────────────────────────

function DayColumn({
  date, dayMs, dayLabel, isToday, isSaturday, isSunday,
  categories, categoryMap, dayCategories, plans, messages,
  isPending, startTransition, router,
}: {
  date: Date;
  dayMs: number;
  dayLabel: string;
  isToday: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  categories: MobileCategory[];
  categoryMap: Map<string, MobileCategory>;
  dayCategories: DayCategory[];
  plans: Plan[];
  messages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const [addCatOpen, setAddCatOpen] = useState(false);

  // Categories already added to this day
  const addedCatIds = useMemo(
    () => new Set(dayCategories.map((dc) => dc.category_id)),
    [dayCategories],
  );

  // Available categories to add
  const availableCategories = useMemo(
    () => categories.filter((c) => !addedCatIds.has(c.id)),
    [categories, addedCatIds],
  );

  // Sort day categories by category order_index
  const sortedDayCats = useMemo(
    () => [...dayCategories].sort((a, b) => {
      const catA = categoryMap.get(a.category_id);
      const catB = categoryMap.get(b.category_id);
      return (catA?.order_index ?? 0) - (catB?.order_index ?? 0);
    }),
    [dayCategories, categoryMap],
  );

  function handleAddCategory(categoryId: string) {
    setAddCatOpen(false);
    startTransition(async () => {
      try {
        await addCategoryToDay(dayMs, categoryId);
        router.refresh();
      } catch { toast.error("카테고리 추가 실패"); }
    });
  }

  function handleRemoveCategory(dayCategoryId: string) {
    startTransition(async () => {
      try {
        await removeCategoryFromDay(dayCategoryId);
        router.refresh();
      } catch { toast.error("카테고리 제거 실패"); }
    });
  }

  const dayNum = date.getDate();

  return (
    <div className={[
      "flex flex-col rounded-lg border min-h-0",
      isToday && "ring-2 ring-primary/50",
    ].filter(Boolean).join(" ")}>
      {/* Day Header */}
      <div className={[
        "px-2 py-1.5 border-b text-center",
        isToday && "bg-primary/5",
      ].filter(Boolean).join(" ")}>
        <span className={[
          "text-xs font-medium",
          isSunday && "text-red-500",
          isSaturday && "text-blue-500",
        ].filter(Boolean).join(" ")}>
          {dayLabel}
        </span>
        <span className={[
          "ml-1 text-sm font-semibold",
          isToday && "text-primary",
        ].filter(Boolean).join(" ")}>
          {dayNum}
        </span>
      </div>

      {/* Category Sections */}
      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {sortedDayCats.map((dc) => {
          const cat = categoryMap.get(dc.category_id);
          if (!cat) return null;
          const catPlans = plans.filter((p) => p.category_id === dc.category_id);
          const catMessages = messages.filter((m) => m.category_id === dc.category_id);

          return (
            <CategorySection
              key={dc.id}
              category={cat}
              dayCategoryId={dc.id}
              dayMs={dayMs}
              plans={catPlans}
              messages={catMessages}
              allDayMessages={messages}
              isPending={isPending}
              startTransition={startTransition}
              router={router}
              onRemove={() => handleRemoveCategory(dc.id)}
            />
          );
        })}

        {/* Add Category Button */}
        {availableCategories.length > 0 && (
          <Popover open={addCatOpen} onOpenChange={setAddCatOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                disabled={isPending}
              >
                <Plus className="h-3 w-3" /> 카테고리
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {availableCategories.map((c) => (
                <button
                  key={c.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                  onClick={() => handleAddCategory(c.id)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: argbToHex(c.color) }}
                  />
                  {c.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {dayCategories.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            카테고리를 추가하세요
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Category Section ──────────────────────────────────────────

function CategorySection({
  category, dayCategoryId, dayMs, plans, messages, allDayMessages,
  isPending, startTransition, router, onRemove,
}: {
  category: MobileCategory;
  dayCategoryId: string;
  dayMs: number;
  plans: Plan[];
  messages: CapturedMessage[];
  allDayMessages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
  onRemove: () => void;
}) {
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const color = argbToHex(category.color);

  function handleAddPlan() {
    const title = newPlanTitle.trim();
    if (!title) return;
    setNewPlanTitle("");
    setIsAdding(false);
    startTransition(async () => {
      try {
        await createPlan({ category_id: category.id, date: dayMs, title });
        router.refresh();
      } catch { toast.error("플랜 추가 실패"); }
    });
  }

  return (
    <div className="rounded border bg-card">
      {/* Section Header */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b bg-muted/30">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-medium truncate flex-1">{category.name}</span>

        {/* Message count badge */}
        {messages.length > 0 && (
          <MessageCountPopover messages={messages} color={color} />
        )}

        {/* Add plan button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
              onClick={() => setIsAdding(true)}
              disabled={isPending}
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>플랜 추가</TooltipContent>
        </Tooltip>

        {/* Remove category */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
              onClick={onRemove}
              disabled={isPending}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>카테고리 제거</TooltipContent>
        </Tooltip>
      </div>

      {/* Plan Items */}
      <div className="p-1 space-y-0.5">
        {plans.map((plan) => (
          <PlanItem
            key={plan.id}
            plan={plan}
            allDayMessages={allDayMessages}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />
        ))}

        {/* Inline add plan */}
        {isAdding && (
          <form
            className="flex items-center gap-1 p-0.5"
            onSubmit={(e) => { e.preventDefault(); handleAddPlan(); }}
          >
            <Input
              value={newPlanTitle}
              onChange={(e) => setNewPlanTitle(e.target.value)}
              placeholder="플랜 입력..."
              className="h-6 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") { setIsAdding(false); setNewPlanTitle(""); }
              }}
            />
            <Button type="submit" size="icon" variant="ghost" className="h-6 w-6 shrink-0" disabled={isPending || !newPlanTitle.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </form>
        )}

        {plans.length === 0 && !isAdding && (
          <button
            className="w-full text-[10px] text-muted-foreground py-1 hover:text-foreground transition-colors"
            onClick={() => setIsAdding(true)}
          >
            + 플랜 추가
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Plan Item ─────────────────────────────────────────────────

function PlanItem({
  plan, allDayMessages, isPending, startTransition, router,
}: {
  plan: Plan;
  allDayMessages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderNum, setOrderNum] = useState(plan.order_number ?? "");

  function handleToggle() {
    startTransition(async () => {
      try {
        await togglePlanCompletion(plan.id, !plan.is_completed);
        router.refresh();
      } catch { toast.error("상태 변경 실패"); }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePlan(plan.id);
        router.refresh();
      } catch { toast.error("삭제 실패"); }
    });
  }

  function handleLinkMessage(messageId: string | null) {
    startTransition(async () => {
      try {
        await linkPlanToMessage(plan.id, messageId);
        toast.success(messageId ? "메시지가 연결되었습니다." : "연결이 해제되었습니다.");
        router.refresh();
      } catch { toast.error("연결 실패"); }
    });
  }

  function handleSaveOrderNumber() {
    setOrderDialogOpen(false);
    startTransition(async () => {
      try {
        await updatePlanOrderNumber(plan.id, orderNum || null);
        router.refresh();
      } catch { toast.error("주문번호 저장 실패"); }
    });
  }

  // Find linked message
  const linkedMessage = plan.linked_message_id
    ? allDayMessages.find((m) => m.id === plan.linked_message_id)
    : null;

  return (
    <div className={[
      "group flex items-start gap-1 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors",
      plan.is_completed && "opacity-50",
    ].filter(Boolean).join(" ")}>
      {/* Checkbox */}
      <Checkbox
        checked={plan.is_completed}
        onCheckedChange={handleToggle}
        disabled={isPending}
        className="mt-0.5 h-3.5 w-3.5"
      />

      {/* Title */}
      <span className={[
        "flex-1 text-xs leading-tight min-w-0 truncate",
        plan.is_completed && "line-through text-muted-foreground",
      ].filter(Boolean).join(" ")}>
        {plan.title}
      </span>

      {/* Action icons (visible on hover) */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        {/* Message link */}
        <MessageLinkPopover
          plan={plan}
          messages={allDayMessages}
          linkedMessage={linkedMessage}
          onLink={handleLinkMessage}
          isPending={isPending}
        />

        {/* Order number */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
              onClick={() => { setOrderNum(plan.order_number ?? ""); setOrderDialogOpen(true); }}
            >
              <Hash className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>주문번호</TooltipContent>
        </Tooltip>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>삭제</TooltipContent>
        </Tooltip>
      </div>

      {/* Always-visible badges */}
      <div className="flex items-center gap-0.5 shrink-0">
        {linkedMessage && (
          <Tooltip>
            <TooltipTrigger>
              <Link2 className="h-3 w-3 text-blue-500" />
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              <p className="text-xs font-medium">{linkedMessage.sender}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{linkedMessage.content}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {plan.order_number && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">
            {plan.order_number}
          </Badge>
        )}
      </div>

      {/* Order Number Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>주문번호 입력</DialogTitle>
          </DialogHeader>
          <Input
            value={orderNum}
            onChange={(e) => setOrderNum(e.target.value)}
            placeholder="주문번호를 입력하세요"
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveOrderNumber(); }}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button onClick={handleSaveOrderNumber} disabled={isPending}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Message Count Popover ─────────────────────────────────────

function MessageCountPopover({
  messages, color,
}: {
  messages: CapturedMessage[];
  color: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium hover:bg-muted transition-colors">
          <MessageSquare className="h-3 w-3" style={{ color }} />
          <span>{messages.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 max-h-60 overflow-y-auto" align="start">
        <h4 className="text-xs font-semibold mb-2">수신 메시지 ({messages.length}건)</h4>
        <div className="space-y-1.5">
          {messages.map((m) => (
            <div key={m.id} className="rounded border p-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium">{m.sender}</span>
                <span className="text-[10px] text-muted-foreground">{formatEpochTime(m.received_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
              <Badge variant="outline" className="mt-1 text-[9px]">{m.app_name}</Badge>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Message Link Popover ──────────────────────────────────────

function MessageLinkPopover({
  plan, messages, linkedMessage, onLink, isPending,
}: {
  plan: Plan;
  messages: CapturedMessage[];
  linkedMessage: CapturedMessage | null | undefined;
  onLink: (messageId: string | null) => void;
  isPending: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
              disabled={isPending}
            >
              <Link2 className={[
                "h-3 w-3",
                linkedMessage ? "text-blue-500" : "text-muted-foreground",
              ].join(" ")} />
            </button>
          </TooltipTrigger>
          <TooltipContent>메시지 연결</TooltipContent>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 max-h-60 overflow-y-auto" align="start">
        <h4 className="text-xs font-semibold mb-2">메시지 연결</h4>

        {linkedMessage && (
          <div className="mb-2">
            <p className="text-[10px] text-muted-foreground mb-1">현재 연결:</p>
            <div className="rounded border p-2 bg-primary/5">
              <p className="text-xs font-medium">{linkedMessage.sender}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{linkedMessage.content}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 h-6 text-xs text-destructive"
              onClick={() => onLink(null)}
            >
              연결 해제
            </Button>
          </div>
        )}

        <div className="space-y-1">
          {messages.filter((m) => m.id !== plan.linked_message_id).map((m) => (
            <button
              key={m.id}
              className="w-full text-left rounded border p-2 hover:bg-muted transition-colors"
              onClick={() => onLink(m.id)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium">{m.sender}</span>
                <span className="text-[10px] text-muted-foreground">{formatEpochTime(m.received_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
            </button>
          ))}
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">이 날짜에 메시지가 없습니다.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
