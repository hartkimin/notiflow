"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClientTabsProps {
  initialTab: string;
  basePath: string;
  tabs: { value: string; label: string; content: React.ReactNode }[];
}

/**
 * Client-side tab switcher. Uses local state for instant switching
 * and updates URL via replaceState for bookmarkability.
 */
export function ClientTabs({ initialTab, basePath, tabs }: ClientTabsProps) {
  const [tab, setTab] = useState(initialTab);

  function handleTabChange(value: string) {
    setTab(value);
    const url = value === tabs[0]?.value ? basePath : `${basePath}?tab=${value}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
