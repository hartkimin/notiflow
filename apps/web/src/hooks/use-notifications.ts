"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "notiflow-notifications-enabled";

/**
 * Hook for managing browser notification permissions and preferences.
 * Stores user preference in localStorage. Registers service worker on enable.
 */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported = typeof window !== "undefined" && "Notification" in window;
    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission);
      setEnabled(localStorage.getItem(STORAGE_KEY) === "true");
    }
  }, []);

  const enable = useCallback(async () => {
    if (!supported) return false;

    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }

    if (perm !== "granted") return false;

    // Register service worker for future push support
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // SW registration is optional for Notification API
      }
    }

    localStorage.setItem(STORAGE_KEY, "true");
    setEnabled(true);
    return true;
  }, [supported]);

  const disable = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "false");
    setEnabled(false);
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      disable();
    } else {
      await enable();
    }
  }, [enabled, enable, disable]);

  const showNotification = useCallback(
    (title: string, body: string, url?: string) => {
      if (!enabled || permission !== "granted") return;

      // Only show when tab is not focused
      if (document.visibilityState === "visible") return;

      try {
        const notification = new Notification(title, {
          body,
          icon: "/next.svg",
          tag: `notiflow-${Date.now()}`,
        });
        notification.onclick = () => {
          window.focus();
          if (url) window.location.href = url;
          notification.close();
        };
      } catch {
        // Fallback: use service worker if direct Notification fails
        navigator.serviceWorker?.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            data: { url: url || "/orders" },
            tag: `notiflow-${Date.now()}`,
          });
        });
      }
    },
    [enabled, permission],
  );

  return { supported, permission, enabled, enable, disable, toggle, showNotification };
}
