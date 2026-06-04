"use client";

import { useEffect, useRef, useState } from "react";
import {
  type FluidIR,
  type FluidSchema,
  checkIRAgainstSchema,
  validateIR,
} from "@fluid-genui/core";
import { type DataContext } from "./data";
import { renderNode } from "./render";
import { useFluidContext } from "./FluidProvider";

interface FluidViewProps {
  /** Optional when a FluidProvider supplies the IR. */
  ir?: unknown;
  data: DataContext;
  /** Optional. When provided, IR is semantically checked against the schema. */
  schema?: FluidSchema;
}

/**
 * Renders a validated FluidIR tree with smooth crossfade transitions
 * when the IR changes (e.g. after a chatbot patch or revert).
 *
 * Uses the View Transition API on supported browsers (Chrome 111+),
 * falls back to a CSS opacity+translateY animation on Safari/Firefox.
 */
export function FluidView({ ir, data, schema }: FluidViewProps) {
  const ctx = useFluidContext();
  const effectiveIR = ir ?? ctx?.ir ?? null;
  const [displayIR, setDisplayIR] = useState<FluidIR | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIRRef = useRef<unknown>(null);

  useEffect(() => {
    if (effectiveIR === null || effectiveIR === undefined) {
      setDisplayIR(null);
      prevIRRef.current = null;
      setError(null);
      return;
    }

    // Validate the incoming IR.
    let validated: FluidIR;
    try {
      validated = validateIR(effectiveIR);
      if (schema) checkIRAgainstSchema(validated, schema);
    } catch (err) {
      setError(String(err));
      return;
    }
    setError(null);

    // Skip transition on first render.
    if (prevIRRef.current === null) {
      setDisplayIR(validated);
      prevIRRef.current = effectiveIR;
      return;
    }

    // Skip if IR hasn't actually changed.
    if (JSON.stringify(effectiveIR) === JSON.stringify(prevIRRef.current)) {
      return;
    }

    prevIRRef.current = effectiveIR;

    // Try View Transition API (Chrome 111+).
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      const transition = (document as any).startViewTransition(() => {
        setDisplayIR(validated);
      });
      // Transition handles animation automatically.
      return;
    }

    // Fallback: CSS crossfade.
    setTransitioning(true);
    const timeout = setTimeout(() => {
      setDisplayIR(validated);
      // Brief delay to let the new content render, then fade in.
      requestAnimationFrame(() => {
        setTransitioning(false);
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [effectiveIR, schema]);

  if (error) {
    return (
      <div
        className="rounded-2xl p-5 text-sm"
        style={{
          background: "rgba(244, 63, 94, 0.05)",
          border: "1px solid rgba(244, 63, 94, 0.15)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-rose-500" style={{ boxShadow: "0 0 8px rgba(244, 63, 94, 0.4)" }} />
          <span className="font-semibold text-rose-300">Invalid IR</span>
        </div>
        <pre className="text-xs text-rose-200/70 whitespace-pre-wrap leading-relaxed">{error}</pre>
      </div>
    );
  }

  if (!displayIR) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`fluid-view-container transition-all duration-300 ease-out ${
        transitioning
          ? "opacity-0 translate-y-2"
          : "opacity-100 translate-y-0"
      }`}
      style={{ viewTransitionName: "fluid-view" } as React.CSSProperties}
    >
      {renderNode(displayIR.root, data)}
    </div>
  );
}

export { type DataContext } from "./data";
