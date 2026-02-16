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
        (payload: { new: { order_number?: string; hospital_name?: string; total_items?: number; id?: number } }) => {
          const order = payload.new;
          showNotification(
            `새 주문: ${order.order_number || ""}`,
            `${order.hospital_name || "거래처"} | ${order.total_items || 0}건 품목`,
            order.id ? `/orders/${order.id}` : "/orders",
          );
        },
      )
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "raw_messages" },
        (payload: { new: { sender_name?: string; content?: string } }) => {
          const msg = payload.new;
          const preview = msg.content?.slice(0, 50) || "새로운 메시지";
          showNotification(
            `메시지 수신: ${msg.sender_name || "알 수 없음"}`,
            preview,
            "/messages",
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, showNotification]);

  return null;
}
