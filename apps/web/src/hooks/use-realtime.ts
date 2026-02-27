"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to Postgres changes on a table via Supabase Realtime.
 * Triggers `router.refresh()` on events, preserving scroll position.
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
  const scrollRef = useRef(0);

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
          scrollRef.current = window.scrollY;
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, opts?.event, opts?.schema, opts?.filter, router]);

  // Restore scroll position after React finishes re-rendering
  useEffect(() => {
    if (scrollRef.current > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollRef.current);
      });
    }
  });
}
