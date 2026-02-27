"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Global component that listens for Supabase Realtime events
 * and triggers browser notifications for new orders and messages.
 * Placed once in the dashboard layout.
 */
export function GlobalNotifications() {
  const { enabled, showNotification } = useNotifications();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase
      .channel("global-notifications")
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "orders" },
        (payload: unknown) => {
          try {
            const { new: order } = payload as { new?: Record<string, unknown> };
            if (!order) return;
            showNotification(
              `새 주문: ${(order.order_number as string) || ""}`,
              `${(order.hospital_name as string) || "거래처"} | ${(order.total_items as number) || 0}건 품목`,
              order.id ? `/orders/${order.id}` : "/orders",
            );
          } catch {
            // Malformed payload — ignore silently
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, showNotification]);

  return null;
}
