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
    // Skip realtime on external domains (Cloudflare Tunnel can't proxy WebSocket)
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      if (h !== "localhost" && h !== "127.0.0.1") return;
    }

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

  // Restore scroll position after React finishes re-rendering.
  // No dependency array intentional: must run after every render caused by router.refresh().
  // scrollRef.current is reset to 0 immediately to prevent re-scrolling on subsequent renders.
  useEffect(() => {
    if (scrollRef.current > 0) {
      const savedY = scrollRef.current;
      scrollRef.current = 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, savedY);
      });
    }
  });
}
