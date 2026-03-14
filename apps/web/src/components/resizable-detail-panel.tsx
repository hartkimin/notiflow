"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface ResizableDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
}

export function ResizableDetailPanel({
  isOpen,
  onClose,
  title,
  children,
  defaultSize = 30,
  minSize = 20,
}: ResizableDetailPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/30 transition-colors w-1.5" />
      <ResizablePanel
        defaultSize={defaultSize}
        minSize={minSize}
        className="bg-background z-30 flex flex-col shadow-[-4px_0_12px_rgba(0,0,0,0.02)]"
      >
        <div className="flex h-14 items-center justify-between px-6 border-b shrink-0 bg-zinc-50/50">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-400 hover:text-zinc-950">
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
      </ResizablePanel>
    </>
  );
}
