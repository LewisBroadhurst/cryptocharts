"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { startAnalytics, track } from "@/lib/analytics/analytics";

/** Counts a visit to each page, and loads the counting once the page has
    settled so it never slows the chart. */
export default function UsageEvents() {
  const pathname = usePathname();

  useEffect(() => {
    const start = () => void startAnalytics().catch(() => {});
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4_000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2_000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    track("$pageview");
  }, [pathname]);

  return null;
}
