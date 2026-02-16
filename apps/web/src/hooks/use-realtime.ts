"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to Postgres changes on a table via Supabase Realtime.
 * Triggers `router.refresh()` on INSERT, UPDATE, or DELETE events
 * so that server components re-fetch fresh data.
 */
export function useRealtime(
  table: string,
  opts?: {
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    schema?: string;
    filter?: string;
  },
) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes" as never,
        {
          event: opts?.event ?? "*",
          schema: opts?.schema ?? "public",
          table,
          ...(opts?.filter ? { filter: opts.filter } : {}),
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, opts?.event, opts?.schema, opts?.filter, router]);
}
