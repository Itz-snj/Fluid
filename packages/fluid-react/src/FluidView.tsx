"use client";

import { useEffect, useRef, useState } from "react";
import {
  type FluidIR,
  type FluidSchema,
  checkIRAgainstSchema,
  validateIR,
} from "@fluid/core";
import { type DataContext } from "./data";
import { renderNode } from "./render";

interface FluidViewProps {
  ir: unknown;
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
  const [displayIR, setDisplayIR] = useState<FluidIR | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIRRef = useRef<unknown>(null);

  useEffect(() => {
    // Validate the incoming IR.
    let validated: FluidIR;
    try {
      validated = validateIR(ir);
      if (schema) checkIRAgainstSchema(validated, schema);
    } catch (err) {
      setError(String(err));
      return;
    }
    setError(null);

    // Skip transition on first render.
    if (prevIRRef.current === null) {
      setDisplayIR(validated);
      prevIRRef.current = ir;
      return;
    }

    // Skip if IR hasn't actually changed.
    if (JSON.stringify(ir) === JSON.stringify(prevIRRef.current)) {
      return;
    }

    prevIRRef.current = ir;

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
  }, [ir, schema]);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">
        <div className="font-medium mb-1">Invalid IR</div>
        <pre className="text-xs opacity-80 whitespace-pre-wrap">{error}</pre>
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
