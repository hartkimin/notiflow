"use client";

import { cn } from "@/lib/utils";

interface ResizableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width: number;
  colKey: string;
  onResizeStart: (col: string, e: React.MouseEvent) => void;
}

export function ResizableTh({ width, colKey, onResizeStart, className, children, ...props }: ResizableThProps) {
  return (
    <th
      data-slot="table-head"
      style={{ width, minWidth: 40, maxWidth: width }}
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap relative group",
        className,
      )}
      {...props}
    >
      {children}
      <div
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 group-hover:bg-border"
        onMouseDown={(e) => onResizeStart(colKey, e)}
      />
    </th>
  );
}
