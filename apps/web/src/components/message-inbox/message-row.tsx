"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, formatDate } from "./constants";
import type { UnifiedMessage, LinkedOrder } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";
import type { RowSelectionHook } from "@/hooks/use-row-selection";
import Link from "next/link";

type StringRowSelection = RowSelectionHook<string>;

const SOURCE_COLOR: Record<string, string> = {
  kakaotalk: "bg-amber-50 text-amber-700 border-amber-200",
  sms: "bg-emerald-50 text-emerald-700 border-emerald-200",
  telegram: "bg-sky-50 text-sky-700 border-sky-200",
  manual: "bg-slate-50 text-slate-600 border-slate-200",
};

interface MessageRowProps {
  message: UnifiedMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  localState: MessageLocalStateHook;
  rowSelection: StringRowSelection;
  linkedOrder?: LinkedOrder;
  ref?: React.Ref<HTMLDivElement>;
}

export function MessageRow({
  message, isExpanded, onToggleExpand, localState, rowSelection, linkedOrder, ref,
}: MessageRowProps) {
  const msg = message;
  const msgLocal = localState.getState(msg.id);
  const statusStep = localState.steps.find((s) => s.id === msgLocal.statusId);
  const isChecked = rowSelection.selected.has(msg.id);
  const content = msgLocal.editedContent ?? msg.content;
  const isUnread = msg.is_read === false;

  return (
    <div ref={ref}>
      <div
        className={cn(
          "grid grid-cols-[36px_110px_65px_100px_1fr_75px_110px] items-center gap-1 px-3 py-2 border-b cursor-pointer transition-all duration-150 text-sm",
          "hover:bg-indigo-50/40",
          isChecked && "bg-indigo-50/60 border-l-2 border-l-indigo-400",
          isExpanded && !isChecked && "bg-sky-50/40 border-l-2 border-l-sky-400",
          isUnread && !isExpanded && !isChecked && "bg-amber-50/30 border-l-2 border-l-amber-300",
          !isChecked && !isExpanded && !isUnread && "border-l-2 border-l-transparent",
        )}
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => rowSelection.toggle(msg.id)}
          />
        </div>

        {/* Time */}
        <span className={cn("text-xs truncate", isUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
          {formatDate(msg.received_at)}
        </span>

        {/* Source badge */}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 h-5 justify-center",
            SOURCE_COLOR[msg.source_app] || SOURCE_COLOR.manual,
          )}
        >
          {SOURCE_LABEL[msg.source_app] || msg.source_app}
        </Badge>

        {/* Sender + Room */}
        <div className="flex flex-col min-w-0">
          <span className={cn("text-xs truncate", isUnread ? "font-semibold" : "font-medium")} title={msg.sender || ""}>
            {msg.sender || "(발신자 없음)"}
          </span>
          {msg.room_name && (
            <span className="text-[10px] text-muted-foreground truncate" title={msg.room_name}>
              {msg.room_name}
            </span>
          )}
        </div>

        {/* Content with tooltip */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className={cn("text-xs truncate min-w-0", isUnread ? "text-foreground" : "text-muted-foreground")}>
                {content}
              </p>
            </TooltipTrigger>
            {content && content.length > 50 && (
              <TooltipContent side="bottom" align="start" className="max-w-[400px] max-h-[200px] overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{content.slice(0, 500)}{content.length > 500 ? "..." : ""}</pre>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Status badge */}
        <div className="flex items-center justify-end">
          {statusStep ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 gap-1"
              style={{ borderColor: statusStep.color, color: statusStep.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStep.color }} />
              {statusStep.name}
            </Badge>
          ) : isUnread ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-300 text-amber-600 bg-amber-50">
              새 메시지
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">-</span>
          )}
        </div>

        {/* Linked order */}
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          {linkedOrder ? (
            <Link href={`/orders/${linkedOrder.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-600 transition-all duration-200 shadow-sm hover:shadow">
              📋 {linkedOrder.order_number.replace("ORD-", "")}
            </Link>
          ) : (
            <span className="text-[10px] text-muted-foreground/30">-</span>
          )}
        </div>
      </div>
    </div>
  );
}
