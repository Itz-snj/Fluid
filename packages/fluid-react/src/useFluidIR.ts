"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FluidIR } from "@fluid-genui/core";
import { type FetchIROptions, fetchIR } from "./fetchIR";
import { useFluidContext } from "./FluidProvider";

export interface UseFluidIROptions extends Omit<FetchIROptions, "init" | "endpoint"> {
  /** Optional when a FluidProvider is mounted. Defaults to endpoints.generate. */
  endpoint?: string;
  /** Skip the initial fetch — call refetch() manually. */
  manual?: boolean;
}

export interface UseFluidIRState {
  ir: FluidIR | null;
  loading: boolean;
  error: Error | null;
  cached: boolean | null;
  /** Set by the learn-loop server path; `null` on stateless generation. */
  profile: unknown;
  /** Set when the consumer's server route persists a snapshot per generation. */
  snapshotId?: string;
  refetch: (overrides?: { bypassCache?: boolean; intent?: string }) => Promise<void>;
}

/**
 * Client hook that mirrors the server's generate flow.
 *
 * Re-fetches whenever endpoint/intent/userId change. Aborts in-flight
 * requests on unmount or on a new fetch — consumers don't have to manage
 * AbortControllers themselves.
 *
 * The cache discussed in the docs lives server-side. This hook only owns
 * component-local state.
 */
export function useFluidIR(opts: UseFluidIROptions): UseFluidIRState {
  const ctx = useFluidContext();
  const endpoint = opts.endpoint ?? ctx?.endpoints.generate ?? "/api/generate";
  const userId = opts.userId ?? ctx?.userId;
  const { intent, bypassCache, manual, extraBody } = opts;
  const [ir, setIR] = useState<FluidIR | null>(null);
  const [loading, setLoading] = useState(!manual);
  const [error, setError] = useState<Error | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<unknown>(null);
  const [snapshotId, setSnapshotId] = useState<string | undefined>(undefined);
  const inflightRef = useRef<AbortController | null>(null);

  // Stable ref so extraBody changes don't churn the run() identity.
  const extraBodyRef = useRef(extraBody);
  extraBodyRef.current = extraBody;

  const run = useCallback(
    async (overrides?: { bypassCache?: boolean; intent?: string }) => {
      inflightRef.current?.abort();
      const ac = new AbortController();
      inflightRef.current = ac;

      setLoading(true);
      setError(null);
      try {
        const res = await fetchIR({
          endpoint,
          intent: overrides?.intent ?? intent,
          userId,
          bypassCache: overrides?.bypassCache ?? bypassCache,
          extraBody: extraBodyRef.current,
          init: { signal: ac.signal },
        });
        if (ac.signal.aborted) return;
        setIR(res.ir);
        setCached(res.cached);
        setProfile(res.profile ?? null);
        setSnapshotId(res.snapshotId);
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [endpoint, intent, userId, bypassCache],
  );

  useEffect(() => {
    if (manual) return;
    void run();
    return () => inflightRef.current?.abort();
  }, [run, manual]);

  return { ir, loading, error, cached, profile, snapshotId, refetch: run };
}
