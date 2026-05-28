import { type FluidIR, type FluidSchema, validateIR } from "@/fluid/core";
import { getProvider } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { getCachedIR, intentKey, setCachedIR } from "./cache";

export interface GenerateIROptions {
  schema: FluidSchema;
  intent: string;
  /** Skip cache lookup. Useful for "regenerate" buttons. */
  bypassCache?: boolean;
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
}

const MAX_RETRIES = 1;

/**
 * Schema + intent → validated IR.
 *
 * Flow:
 *   1. Cache lookup. Cheap path — no LLM call.
 *   2. Build system prompt (stable, cacheable) + user message (volatile intent).
 *   3. Provider call.
 *   4. Strip optional code fences, parse JSON, validate against IR Zod schema.
 *   5. On parse/validate failure: ONE retry with the error fed back. If it fails
 *      a second time, throw — caller falls back to a preset archetype.
 */
export async function generateIR(opts: GenerateIROptions): Promise<GenerateIRResult> {
  const key = intentKey(opts.schema.name, opts.intent);
  if (!opts.bypassCache) {
    const cached = getCachedIR(key);
    if (cached) return { ir: cached, cached: true, usage: null };
  }

  const provider = getProvider();
  const systemPrompt = buildSystemPrompt(opts.schema);
  let userMessage = `User intent: ${opts.intent.trim()}\n\nOutput the IR JSON now.`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await provider.generate({ systemPrompt, userMessage });
    try {
      const parsed = parseIR(result.text);
      const ir = validateIR(parsed);
      setCachedIR(key, ir);
      return { ir, cached: false, usage: result.usage };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      userMessage = `User intent: ${opts.intent.trim()}\n\nYour previous response was invalid:\n${message}\n\nReturn ONLY the corrected IR JSON. No prose, no code fences.`;
    }
  }
  throw new Error(
    `IR generation failed after ${MAX_RETRIES + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function parseIR(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return JSON.parse(cleaned);
}
