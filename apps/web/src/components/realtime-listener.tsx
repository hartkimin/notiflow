"use client";

import { useRealtime } from "@/hooks/use-realtime";

/**
 * Invisible client component that subscribes to Supabase Realtime
 * for one or more tables. When any change is detected, triggers
 * router.refresh() to re-render server components with fresh data.
 *
 * Usage in server component pages:
 *   <RealtimeListener tables={["orders", "order_items"]} />
 */
export function RealtimeListener({
  tables,
  event,
}: {
  tables: string[];
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
}) {
  return (
    <>
      {tables.map((table) => (
        <RealtimeChannel key={table} table={table} event={event} />
      ))}
    </>
  );
}

function RealtimeChannel({
  table,
  event,
}: {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
}) {
  useRealtime(table, event ? { event } : undefined);
  return null;
}
