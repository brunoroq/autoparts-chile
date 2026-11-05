"use client";
import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useAnalytics } from "./analytics-provider";
import { normalizedPath } from "@/lib/analytics/contracts";
import type { Vital } from "@/lib/observability/vitals";
export function WebVitals() {
  const { config } = useAnalytics(),
    path = usePathname();
  const initialPath = useRef(normalizedPath(path));
  const latest = useRef(new Map<string, Omit<Vital, "unit">>()),
    sent = useRef(new Map<string, number>());
  const callback = useCallback(
    (metric: Parameters<Parameters<typeof useReportWebVitals>[0]>[0]) => {
      if (!config.vitals || !["LCP", "CLS", "INP"].includes(metric.name))
        return;
      const previous = latest.current.get(metric.id);
      if (previous?.value === metric.value) return;
      latest.current.set(metric.id, {
        id: metric.id,
        name: metric.name as Vital["name"],
        value: metric.value,
        sequence: (previous?.sequence ?? 0) + 1,
        path: initialPath.current,
        device:
          previous?.device ??
          (matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop"),
      });
    },
    [config.vitals],
  );
  useReportWebVitals(callback);
  useEffect(() => {
    if (!config.vitals) return;
    function flush() {
      const metrics = [...latest.current.values()].filter(
        (m) => sent.current.get(m.id) !== m.sequence,
      );
      if (!metrics.length) return;
      for (const m of metrics) sent.current.set(m.id, m.sequence);
      void fetch("/api/v1/telemetry/web-vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
        keepalive: true,
      }).catch(() => {
        /* Mejor esfuerzo, sin reintentos ni datos identificatorios. */
      });
    }
    function hidden() {
      if (document.visibilityState === "hidden") flush();
    }
    const timer = setInterval(flush, 5000);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [config.vitals]);
  return null;
}
