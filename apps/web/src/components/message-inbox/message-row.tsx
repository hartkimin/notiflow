"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

  return (
    <div ref={ref}>
      <div
        className={cn(
          "grid grid-cols-[36px_130px_80px_120px_120px_1fr_80px] items-center gap-1 px-3 py-2 border-b cursor-pointer transition-colors text-sm",
          "hover:bg-muted/50",
          isChecked && "bg-blue-50 dark:bg-blue-950/30",
          isExpanded && !isChecked && "bg-blue-50/50 dark:bg-blue-950/15",
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
        <span className="text-xs text-muted-foreground truncate">
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

        {/* Sender */}
        <span className="text-xs font-medium truncate">
          {msg.sender || "(발신자 없음)"}
        </span>

        {/* Room name */}
        <span className="text-xs text-muted-foreground truncate">
          {msg.room_name || "-"}
        </span>

        {/* Content truncated */}
        <p className="text-xs text-muted-foreground truncate min-w-0">
          {msgLocal.editedContent ?? msg.content}
        </p>

        {/* Status dot */}
        <div className="flex items-center justify-center">
          {statusStep ? (
            <span className="inline-flex items-center gap-1 text-[10px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusStep.color }} />
              {statusStep.name}
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-gray-300" />
          )}
        </div>
      </div>

      {/* Detail is now rendered in the side panel, not inline */}
    </div>
  );
}
