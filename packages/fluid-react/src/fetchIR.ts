import type { FluidIR } from "@fluid/core";

export interface FetchIRRequest {
  intent: string;
  bypassCache?: boolean;
  userId?: string;
  /**
   * Extra fields merged into the POST body. Useful for app-specific options
   * like `{ learn: true, role: "engineer" }` that the consumer's route reads
   * and forwards to `engine.refine`.
   */
  extraBody?: Record<string, unknown>;
}

export interface FetchIRResponse {
  ir: FluidIR;
  cached: boolean;
  latencyMs: number;
  attempts: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
  /**
   * Returned by the learn-loop path (engine.refine). `null` for stateless
   * generate calls. Shape is `IntentProfile` from @fluid/engine.
   */
  profile?: unknown;
  /** Server-issued snapshot ID, when the consumer's route persists snapshots. */
  snapshotId?: string;
}

export interface FetchIROptions extends FetchIRRequest {
  /** Endpoint that runs createEngine().generate on the server. */
  endpoint: string;
  /** Forwarded to fetch — useful for aborts and cookies. */
  init?: Omit<RequestInit, "method" | "body">;
}

/**
 * Thin client over the consumer's own /api/<whatever> endpoint.
 *
 * The endpoint is expected to call `engine.generate(...)` server-side and
 * return `{ ir, cached, latencyMs, attempts, usage }`. Anything beyond that
 * shape (auth, multi-schema dispatch, per-user namespacing) is the consumer's
 * to define.
 */
export async function fetchIR(opts: FetchIROptions): Promise<FetchIRResponse> {
  const { endpoint, init, extraBody, ...body } = opts;
  const merged = { ...body, ...(extraBody ?? {}) };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(merged),
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchIR ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as FetchIRResponse;
}
