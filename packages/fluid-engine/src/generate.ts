import {
  type FluidIR,
  type FluidSchema,
  checkIRAgainstSchema,
  IRSemanticError,
  validateIR,
} from "@fluid/core";
import type { CacheAdapter } from "./adapters";
import type { LLMProvider } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { intentKey } from "./cache";

export interface GenerateIROptions {
  schema: FluidSchema;
  intent: string;
  /** Optional namespace for the cache key (e.g. user id). */
  userId?: string;
  /** Skip cache lookup. Useful for "regenerate" buttons. */
  bypassCache?: boolean;
  /** Optional abort signal forwarded to the provider. */
  signal?: AbortSignal;
}

export interface GenerateIRResult {
  ir: FluidIR;
  cached: boolean;
  /** Token usage when not cached. Null on cache hit. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
  attempts: number;
}

interface GenerateIRDeps {
  provider: LLMProvider;
  cache: CacheAdapter;
}

const MAX_RETRIES = 2;

/**
 * Schema + intent → validated IR.
 *
 * Pure function over its dependencies — provider and cache are injected.
 * Use the createEngine() factory if you don't want to wire these by hand.
 *
 * Flow:
 *   1. Cache lookup. Cheap path — no LLM call.
 *   2. Single-flight (if the adapter implements it): dedup concurrent calls.
 *   3. Build system prompt (stable, cacheable) + user message (volatile intent).
 *   4. Provider call.
 *   5. Strip optional code fences / extract balanced JSON, parse, validate
 *      against both the Zod IR schema and the developer's FluidSchema.
 *   6. On parse/validate failure: ONE retry with the error fed back. If it fails
 *      a second time, throw — caller falls back to a preset archetype.
 */
export async function generateIR(
  opts: GenerateIROptions,
  deps: GenerateIRDeps,
): Promise<GenerateIRResult> {
  const { provider, cache } = deps;
  const key = intentKey(opts.schema.name, opts.intent, opts.userId);

  if (!opts.bypassCache) {
    const cached = await cache.get(key);
    if (cached) return { ir: cached, cached: true, usage: null, attempts: 0 };
  }

  let usage: GenerateIRResult["usage"] = null;
  let attempts = 0;

  const work = async (): Promise<FluidIR> => {
    if (!opts.bypassCache) {
      const cached = await cache.get(key);
      if (cached) return cached;
    }

    const systemPrompt = buildSystemPrompt(opts.schema);
    let userMessage = `User intent: ${opts.intent.trim()}\n\nOutput the IR JSON now.`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      attempts = attempt + 1;
      if (opts.signal?.aborted) {
        throw new Error("Generation aborted");
      }
      const result = await provider.generate({
        systemPrompt,
        userMessage,
        signal: opts.signal,
      });
      usage = result.usage;
      try {
        const parsed = parseIR(result.text);
        const validated = validateIR(parsed);
        checkIRAgainstSchema(validated, opts.schema);
        await cache.set(key, validated);
        return validated;
      } catch (err) {
        lastError = err;
        userMessage = buildRetryMessage(opts.intent, err);
      }
    }
    throw new Error(
      `IR generation failed after ${MAX_RETRIES + 1} attempts: ${errMsg(lastError)}`,
    );
  };

  const ir = cache.singleFlight
    ? await cache.singleFlight(key, work)
    : await work();

  return { ir, cached: false, usage, attempts };
}

function buildRetryMessage(intent: string, err: unknown): string {
  const message = errMsg(err);
  const kind =
    err instanceof IRSemanticError
      ? "schema-violation"
      : err instanceof SyntaxError
        ? "invalid-json"
        : "invalid-ir";
  return `User intent: ${intent.trim()}\n\nYour previous response failed (${kind}):\n${message}\n\nReturn ONLY the corrected IR JSON. No prose, no code fences. Only reference entities and fields declared in the schema.`;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Best-effort JSON extraction.
 *
 * The model is instructed to return raw JSON, but real LLM output sometimes:
 *   - wraps the JSON in ```json ... ``` fences
 *   - prefixes a one-liner explanation
 *   - emits the JSON inside a longer reasoning block
 *
 * Strategy: try a direct parse first; if that fails, strip fences; if still
 * failing, find the first balanced { ... } block and parse that.
 */
function parseIR(text: string): unknown {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  if (cleaned.startsWith("```")) {
    const stripped = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      return JSON.parse(stripped);
    } catch {
      // fall through
    }
  }

  const balanced = extractBalancedJSON(cleaned);
  if (balanced) return JSON.parse(balanced);

  return JSON.parse(cleaned);
}

/** Find the first { ... } that has balanced braces, respecting strings. */
function extractBalancedJSON(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
