"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1"
      onClick={() => window.print()}
    >
      <Printer className="h-3.5 w-3.5" />
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
        인쇄 / PDF
      </span>
    </Button>
  );
}
