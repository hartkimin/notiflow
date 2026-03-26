"use client";

import { useId, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClientTabsProps {
  initialTab: string;
  basePath: string;
  tabs: { value: string; label: string; content: React.ReactNode }[];
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
}

/**
 * Client-side tab switcher. Uses local state for instant switching
 * and updates URL via replaceState for bookmarkability.
 * Uses a stable useId() prefix to avoid SSR/CSR hydration mismatch.
 */
export function ClientTabs({ initialTab, basePath, tabs, toolbarLeft, toolbarRight }: ClientTabsProps) {
  const [tab, setTab] = useState(initialTab);
  const stableId = useId();

  function handleTabChange(value: string) {
    setTab(value);
    const url = value === tabs[0]?.value ? basePath : `${basePath}?tab=${value}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange} id={stableId}>
      {toolbarLeft || toolbarRight ? (
        <div className="flex items-center gap-2 flex-wrap">
          {toolbarLeft}
          <TabsList className="h-8">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs h-7 px-2.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {toolbarRight}
        </div>
      ) : (
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
