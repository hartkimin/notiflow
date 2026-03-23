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
import type { UnifiedMessage } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

type StringRowSelection = RowSelectionHook<string>;

const SOURCE_COLOR: Record<string, string> = {
  kakaotalk: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sms: "bg-green-100 text-green-800 border-green-300",
  telegram: "bg-blue-100 text-blue-800 border-blue-300",
  manual: "bg-gray-100 text-gray-800 border-gray-300",
};

interface MessageRowProps {
  message: UnifiedMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  localState: MessageLocalStateHook;
  rowSelection: StringRowSelection;
  ref?: React.Ref<HTMLDivElement>;
}

export function MessageRow({
  message, isExpanded, onToggleExpand, localState, rowSelection, ref,
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
          "grid grid-cols-[36px_130px_80px_120px_1fr_90px] items-center gap-1 px-3 py-2 border-b cursor-pointer transition-colors text-sm",
          "hover:bg-muted/50",
          isChecked && "bg-blue-50 dark:bg-blue-950/30",
          isExpanded && !isChecked && "bg-blue-50/50 dark:bg-blue-950/15",
          isUnread && !isExpanded && !isChecked && "bg-orange-50/40",
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-orange-300 text-orange-600 bg-orange-50">
              새 메시지
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">-</span>
          )}
        </div>
      </div>
    </div>
  );
}
