"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "sidebar-collapsed";
const COLLAPSE_EVENT = "sidebar:request-collapse";

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Listen for collapse requests from child components
  useEffect(() => {
    function handleCollapseRequest() {
      setCollapsed(true);
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* ignore */
      }
    }
    window.addEventListener(COLLAPSE_EVENT, handleCollapseRequest);
    return () => window.removeEventListener(COLLAPSE_EVENT, handleCollapseRequest);
  }, []);

  return { collapsed, toggle };
}

/** Dispatch from any component to request sidebar collapse */
export function requestSidebarCollapse() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COLLAPSE_EVENT));
  }
}
