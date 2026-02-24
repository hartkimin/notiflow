"use client";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "./category-manager";
import { FilterRuleEditor } from "./filter-rule-editor";
import type { MobileCategory, FilterRule } from "@/lib/types";

interface CalendarSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: MobileCategory[];
  filterRules: FilterRule[];
}

export function CalendarSidePanel({
  open, onOpenChange, categories, filterRules,
}: CalendarSidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>캘린더 설정</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="categories" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="categories" className="flex-1">카테고리</TabsTrigger>
            <TabsTrigger value="rules" className="flex-1">필터 규칙</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            <CategoryManager categories={categories} />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <FilterRuleEditor filterRules={filterRules} categories={categories} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
