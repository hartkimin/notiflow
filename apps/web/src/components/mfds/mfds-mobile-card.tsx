"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { MfdsRowDetail } from "./mfds-row-detail";
import type { MfdsApiSource } from "@/lib/types";

interface MfdsMobileCardProps {
  item: Record<string, unknown>;
  tab: MfdsApiSource;
  isExpanded: boolean;
  onToggle: () => void;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
}

export function MfdsMobileCard({
  item,
  tab,
  isExpanded,
  onToggle,
  isAdded,
  isAdding,
  onAdd,
}: MfdsMobileCardProps) {
  const name = (tab === "drug" ? item.item_name : item.prdlst_nm) as string ?? "";
  const company = (tab === "drug" ? item.entp_name : item.mnft_iprt_entp_nm) as string ?? "";
  const code = (tab === "drug" ? item.bar_code : item.udidi_cd) as string ?? "";
  const status = tab === "drug" ? (item.cancel_name as string ?? "") : (item.clsf_no_grad_cd as string ?? "");

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{company}</p>
          {code && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{code}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <Badge variant="outline" className="text-xs">{status}</Badge>
          )}
          {isAdded ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3" /> 추가됨
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={isAdding}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              {isAdding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t">
          <MfdsRowDetail
            item={item}
            tab={tab}
            isAdded={isAdded}
            isAdding={isAdding}
            onAdd={onAdd}
            colSpan={1}
            variant="div"
          />
        </div>
      )}
    </div>
  );
}
