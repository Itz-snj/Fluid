"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FluidIR } from "@fluid-genui/core";

export interface FluidEndpoints {
  /** POST — generate IR from intent. Default "/api/generate". */
  generate?: string;
  /** POST — execute a schema mutation. Default "/api/mutate". */
  mutate?: string;
  /** POST — batched usage events. Default "/api/telemetry". */
  telemetry?: string;
  /** GET (load history) + POST (send message). Default "/api/chat". */
  chat?: string;
  /** POST — revert to a previous snapshot. Default "/api/chat/revert". */
  chatRevert?: string;
  /** GET — pending AI suggestions. Default "/api/suggestions". */
  suggestions?: string;
  /** POST — accept/dismiss a suggestion. Default "/api/suggestions/resolve". */
  suggestionsResolve?: string;
  /** GET — IR version history. Default "/api/ir/history". */
  irHistory?: string;
}

const DEFAULT_ENDPOINTS: Required<FluidEndpoints> = {
  generate: "/api/generate",
  mutate: "/api/mutate",
  telemetry: "/api/telemetry",
  chat: "/api/chat",
  chatRevert: "/api/chat/revert",
  suggestions: "/api/suggestions",
  suggestionsResolve: "/api/suggestions/resolve",
  irHistory: "/api/ir/history",
};

export interface FluidContextValue {
  userId: string;
  schemaName: string;
  endpoints: Required<FluidEndpoints>;
  ir: FluidIR | null;
  setIR: (ir: FluidIR, snapshotId?: string, version?: number) => void;
  currentSnapshotId?: string;
  currentVersion?: number;
}

const FluidContext = createContext<FluidContextValue | null>(null);

export interface FluidProviderProps {
  /** Required. Stable per-user ID. localStorage UUID is a fine default. */
  userId: string;
  /** Schema name (matches the `name` field on your defineSchema call). */
  schemaName: string;
  /** Override any default endpoint path. Unset values fall back to "/api/*". */
  endpoints?: FluidEndpoints;
  /**
   * Controlled IR. Pass alongside `onIRChange` if you want to own the state
   * yourself (e.g. mix server-generated and chat-patched IRs).
   */
  ir?: FluidIR | null;
  /** Required when `ir` is supplied (controlled). */
  onIRChange?: (ir: FluidIR, snapshotId?: string, version?: number) => void;
  /** Initial IR for the uncontrolled path. Ignored when `ir` is supplied. */
  initialIR?: FluidIR | null;
  currentSnapshotId?: string;
  currentVersion?: number;
  children: ReactNode;
}

/**
 * Wrap your app (or a subtree) so `<FluidChat />`, `<FluidView />`, and the
 * hooks can pick up `userId`, `schemaName`, endpoint paths, and the current
 * IR from context — no prop threading required.
 *
 * Both controlled (`ir` + `onIRChange`) and uncontrolled (`initialIR`) modes
 * are supported, mirroring the React `<input>` API.
 */
export function FluidProvider({
  userId,
  schemaName,
  endpoints,
  ir,
  onIRChange,
  initialIR = null,
  currentSnapshotId,
  currentVersion,
  children,
}: FluidProviderProps) {
  const [internalIR, setInternalIR] = useState<FluidIR | null>(initialIR);
  const [internalSnapshotId, setInternalSnapshotId] = useState<string | undefined>(
    currentSnapshotId,
  );
  const [internalVersion, setInternalVersion] = useState<number | undefined>(
    currentVersion,
  );

  const isControlled = ir !== undefined;
  const activeIR = isControlled ? ir : internalIR;
  const activeSnapshotId = isControlled ? currentSnapshotId : internalSnapshotId;
  const activeVersion = isControlled ? currentVersion : internalVersion;

  const value = useMemo<FluidContextValue>(() => {
    const mergedEndpoints: Required<FluidEndpoints> = {
      ...DEFAULT_ENDPOINTS,
      ...(endpoints ?? {}),
    };
    const setIR: FluidContextValue["setIR"] = (next, snapshotId, version) => {
      if (isControlled) {
        onIRChange?.(next, snapshotId, version);
      } else {
        setInternalIR(next);
        if (snapshotId !== undefined) setInternalSnapshotId(snapshotId);
        if (version !== undefined) setInternalVersion(version);
      }
    };
    return {
      userId,
      schemaName,
      endpoints: mergedEndpoints,
      ir: activeIR ?? null,
      setIR,
      currentSnapshotId: activeSnapshotId,
      currentVersion: activeVersion,
    };
  }, [
    userId,
    schemaName,
    endpoints,
    isControlled,
    onIRChange,
    activeIR,
    activeSnapshotId,
    activeVersion,
  ]);

  return <FluidContext.Provider value={value}>{children}</FluidContext.Provider>;
}

/** Returns the FluidContext value, or `null` if no provider is mounted. */
export function useFluidContext(): FluidContextValue | null {
  return useContext(FluidContext);
}

/** Internal helper — endpoints with defaults applied, even without a provider. */
export function resolveEndpoints(
  override?: FluidEndpoints,
  fromContext?: Required<FluidEndpoints>,
): Required<FluidEndpoints> {
  return {
    ...DEFAULT_ENDPOINTS,
    ...(fromContext ?? {}),
    ...(override ?? {}),
  };
}

export { DEFAULT_ENDPOINTS };
