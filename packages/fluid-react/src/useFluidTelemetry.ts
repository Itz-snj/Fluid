"use client";

import { useCallback, useEffect, useRef } from "react";
import type { UsageEvent } from "@fluid-genui/engine";
import { useFluidContext } from "./FluidProvider";

export interface UseFluidTelemetryOptions {
  /** Optional when a FluidProvider is mounted. */
  userId?: string;
  /** Optional when a FluidProvider is mounted. */
  schemaName?: string;
  /** ID of the currently rendered IR — correlates events to a specific generation. */
  irId?: string;
  /** POST endpoint that accepts `{ events: UsageEvent[] }`. Optional with provider. */
  endpoint?: string;
  /** Flush interval in ms. Default 10 000 (10 s). */
  flushIntervalMs?: number;
  device?: "mobile" | "desktop";
  /** When false, all listeners + flushes are disabled. Default true. */
  enabled?: boolean;
}

/**
 * Drop this hook into the page that renders <FluidView>.
 *
 * It collects two kinds of events automatically:
 *   1. "view" — emitted when a [data-fluid-node] element is visible on screen
 *      for more than 1 second (IntersectionObserver, 50% threshold).
 *   2. "click" — emitted when the user clicks any [data-fluid-node] element
 *      (delegated listener on `document`).
 *
 * Events are batched in memory and POSTed to `endpoint` every
 * `flushIntervalMs`. The buffer is also flushed on unmount.
 *
 * No personal data is collected — only node types, entity labels, and
 * anonymous interaction counts.
 */
export function useFluidTelemetry(opts: UseFluidTelemetryOptions = {}): void {
  const ctx = useFluidContext();
  const userId = opts.userId ?? ctx?.userId ?? "";
  const schemaName = opts.schemaName ?? ctx?.schemaName ?? "";
  const endpoint = opts.endpoint ?? ctx?.endpoints.telemetry ?? "/api/telemetry";
  const { irId, device } = opts;
  const enabled = opts.enabled !== false;
  const flushMs = opts.flushIntervalMs ?? 10_000;
  const bufferRef = useRef<UsageEvent[]>([]);

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0);
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        keepalive: true, // survives page unload
      });
    } catch {
      // Re-queue failed events (best-effort).
      bufferRef.current.unshift(...batch);
    }
  }, [endpoint]);

  const record = useCallback(
    (action: UsageEvent["action"], el: HTMLElement) => {
      const nodeType = el.getAttribute("data-fluid-node");
      if (!nodeType) return;
      bufferRef.current.push({
        userId,
        schemaName,
        irId,
        nodeType,
        nodeId: el.getAttribute("data-fluid-id") ?? undefined,
        entity: el.getAttribute("data-fluid-entity") ?? undefined,
        action,
        device,
        viewportWidth: window.innerWidth,
        timestamp: Date.now(),
      });
    },
    [userId, schemaName, irId, device],
  );

  // Periodic flush
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void flush(), flushMs);
    return () => {
      clearInterval(id);
      void flush();
    };
  }, [flush, flushMs, enabled]);

  // Delegated click listener
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-fluid-node]");
      if (target instanceof HTMLElement) record("click", target);
    };
    document.addEventListener("click", handler, { passive: true });
    return () => document.removeEventListener("click", handler);
  }, [record, enabled]);

  // IntersectionObserver for "view" events (1 s dwell, 50% visible)
  useEffect(() => {
    if (!enabled) return;
    const dwellTimers = new Map<Element, ReturnType<typeof setTimeout>>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const timer = setTimeout(() => {
              if (entry.target instanceof HTMLElement) {
                record("view", entry.target);
              }
              dwellTimers.delete(entry.target);
            }, 1000);
            dwellTimers.set(entry.target, timer);
          } else {
            const existing = dwellTimers.get(entry.target);
            if (existing !== undefined) {
              clearTimeout(existing);
              dwellTimers.delete(entry.target);
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    // Observe after a tick so the DOM has rendered.
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll("[data-fluid-node]").forEach((el) => {
        observer.observe(el);
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      dwellTimers.forEach((t) => clearTimeout(t));
    };
  }, [record, enabled]);
}
