"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Plus, X, Link2, Hash, Trash2, MessageSquare, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  createPlan, togglePlanCompletion, deletePlan, linkPlanToMessage,
  updatePlanOrderNumber, addCategoryToDay, removeCategoryFromDay,
} from "@/lib/actions";
import { startOfDayMs, argbToHex, formatEpochTime } from "@/lib/schedule-utils";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

interface DayViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  referenceDate: Date;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}

export function DayView({
  categories, plans, dayCategories, messages,
  referenceDate, isPending, startTransition,
}: DayViewProps) {
  const router = useRouter();
  const dayMs = startOfDayMs(referenceDate);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const addedCatIds = useMemo(
    () => new Set(dayCategories.map((dc) => dc.category_id)),
    [dayCategories],
  );

  const availableCategories = useMemo(
    () => categories.filter((c) => !addedCatIds.has(c.id)),
    [categories, addedCatIds],
  );

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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
      {sortedDayCats.map((dc) => {
        const cat = categoryMap.get(dc.category_id);
        if (!cat) return null;
        const catPlans = plans.filter((p) => p.category_id === dc.category_id);
        const catMessages = messages.filter((m) => m.category_id === dc.category_id);

        return (
          <DayCategorySection
            key={dc.id}
            category={cat}
            dayCategoryId={dc.id}
            dayMs={dayMs}
            plans={catPlans}
            messages={catMessages}
            allMessages={messages}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
            onRemove={() => handleRemoveCategory(dc.id)}
          />
        );
      })}

      {availableCategories.length > 0 && (
        <Popover open={addCatOpen} onOpenChange={setAddCatOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
              <Plus className="h-3.5 w-3.5" /> 카테고리 추가
            </Button>
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

      {dayCategories.length === 0 && messages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          카테고리를 추가하여 일정을 관리하세요
        </p>
      )}

      {/* All received messages for this day */}
      {messages.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium flex-1">수신 메시지</span>
            <Badge variant="outline" className="text-xs">{messages.length}건</Badge>
          </div>
          <div className="p-3 space-y-2">
            {messages.map((m) => {
              const cat = categories.find((c) => c.id === m.category_id);
              return (
                <div key={m.id} className="rounded border p-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{m.sender}</span>
                      {cat && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0"
                          style={{ backgroundColor: argbToHex(cat.color) }}
                        >
                          {cat.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatEpochTime(m.received_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{m.app_name}</Badge>
                    {m.room_name && (
                      <span className="text-[10px] text-muted-foreground">{m.room_name}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day Category Section (expanded layout) ───────────────────

function DayCategorySection({
  category, dayCategoryId, dayMs, plans, messages, allMessages,
  isPending, startTransition, router, onRemove,
}: {
  category: MobileCategory;
  dayCategoryId: string;
  dayMs: number;
  plans: Plan[];
  messages: CapturedMessage[];
  allMessages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
  onRemove: () => void;
}) {
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [messagesExpanded, setMessagesExpanded] = useState(false);
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
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="font-medium flex-1">{category.name}</span>
        {messages.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            {messages.length}
          </Badge>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={() => setIsAdding(true)} disabled={isPending}>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>플랜 추가</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10" onClick={onRemove} disabled={isPending}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>카테고리 제거</TooltipContent>
        </Tooltip>
      </div>

      <div className="p-3 space-y-2">
        {plans.map((plan) => (
          <DayPlanItem
            key={plan.id}
            plan={plan}
            allMessages={allMessages}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />
        ))}

        {isAdding && (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); handleAddPlan(); }}>
            <Input
              value={newPlanTitle}
              onChange={(e) => setNewPlanTitle(e.target.value)}
              placeholder="플랜 입력..."
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Escape") { setIsAdding(false); setNewPlanTitle(""); } }}
            />
            <Button type="submit" size="sm" disabled={isPending || !newPlanTitle.trim()}>추가</Button>
          </form>
        )}

        {plans.length === 0 && !isAdding && (
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsAdding(true)}>
            + 플랜 추가
          </button>
        )}

        {messages.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMessagesExpanded(!messagesExpanded)}
            >
              {messagesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              메시지 ({messages.length}건)
            </button>

            {messagesExpanded && (
              <div className="mt-2 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="rounded border p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{m.sender}</span>
                      <span className="text-xs text-muted-foreground">{formatEpochTime(m.received_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.content}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{m.app_name}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Day Plan Item (expanded) ─────────────────────────────────

function DayPlanItem({
  plan, allMessages, isPending, startTransition, router,
}: {
  plan: Plan;
  allMessages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderNum, setOrderNum] = useState(plan.order_number ?? "");

  const linkedMessage = plan.linked_message_id
    ? allMessages.find((m) => m.id === plan.linked_message_id)
    : null;

  function handleToggle() {
    startTransition(async () => {
      try { await togglePlanCompletion(plan.id, !plan.is_completed); router.refresh(); }
      catch { toast.error("상태 변경 실패"); }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try { await deletePlan(plan.id); router.refresh(); }
      catch { toast.error("삭제 실패"); }
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
      try { await updatePlanOrderNumber(plan.id, orderNum || null); router.refresh(); }
      catch { toast.error("주문번호 저장 실패"); }
    });
  }

  return (
    <div className={[
      "group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors",
      plan.is_completed && "opacity-50",
    ].filter(Boolean).join(" ")}>
      <Checkbox checked={plan.is_completed} onCheckedChange={handleToggle} disabled={isPending} className="mt-0.5" />

      <div className="flex-1 min-w-0">
        <span className={[
          "text-sm",
          plan.is_completed && "line-through text-muted-foreground",
        ].filter(Boolean).join(" ")}>
          {plan.title}
        </span>

        {linkedMessage && (
          <div className="mt-1 flex items-center gap-1 text-xs text-blue-500">
            <Link2 className="h-3 w-3" />
            <span className="truncate">{linkedMessage.sender}: {linkedMessage.content}</span>
          </div>
        )}

        {plan.order_number && (
          <Badge variant="outline" className="mt-1 text-[10px] font-mono">
            #{plan.order_number}
          </Badge>
        )}
      </div>

      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted">
              <Link2 className={["h-4 w-4", linkedMessage ? "text-blue-500" : "text-muted-foreground"].join(" ")} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 max-h-60 overflow-y-auto" align="start">
            <h4 className="text-xs font-semibold mb-2">메시지 연결</h4>
            {linkedMessage && (
              <div className="mb-2">
                <div className="rounded border p-2 bg-primary/5">
                  <p className="text-xs font-medium">{linkedMessage.sender}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{linkedMessage.content}</p>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-1 text-xs text-destructive" onClick={() => handleLinkMessage(null)}>
                  연결 해제
                </Button>
              </div>
            )}
            {allMessages.filter((m) => m.id !== plan.linked_message_id).map((m) => (
              <button
                key={m.id}
                className="w-full text-left rounded border p-2 hover:bg-muted transition-colors mb-1"
                onClick={() => handleLinkMessage(m.id)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium">{m.sender}</span>
                  <span className="text-[10px] text-muted-foreground">{formatEpochTime(m.received_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted"
          onClick={() => { setOrderNum(plan.order_number ?? ""); setOrderDialogOpen(true); }}
        >
          <Hash className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>주문번호 입력</DialogTitle></DialogHeader>
          <Input
            value={orderNum}
            onChange={(e) => setOrderNum(e.target.value)}
            placeholder="주문번호를 입력하세요"
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveOrderNumber(); }}
          />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={handleSaveOrderNumber} disabled={isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
