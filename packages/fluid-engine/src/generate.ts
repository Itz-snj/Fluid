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

/**
 * Build a guaranteed-valid fallback IR from the schema when the LLM fails.
 * Always produces a simple list view of the first entity — never throws.
 */
function buildFallbackIR(schema: FluidSchema, intent: string): FluidIR {
  const entityName = Object.keys(schema.entities)[0] ?? "Item";
  const entity = schema.entities[entityName];
  const fields = Object.keys(entity?.fields ?? {});

  // Try to detect a status/priority field for kanban grouping
  const statusField = fields.find((f) =>
    ["status", "stage", "state"].includes(f.toLowerCase())
  );
  const titleField = fields.find((f) =>
    ["title", "name", "label", "subject"].includes(f.toLowerCase())
  ) ?? fields[0];
  const descField = fields.find((f) =>
    ["description", "desc", "body", "summary", "notes"].includes(f.toLowerCase())
  );
  const priorityField = fields.find((f) => f.toLowerCase().includes("priority"));
  const dateField = fields.find((f) =>
    ["duedate", "due_date", "due", "deadline", "closedate"].includes(f.toLowerCase())
  );

  // Check if intent suggests a kanban
  const wantsKanban = /kanban|board|column|status|stage/i.test(intent);
  // Check if intent suggests a list
  const wantsList = /list|table|row|all tasks|show.*tasks|show.*all/i.test(intent);

  // Get status enum values for kanban columns
  const statusValues: string[] = statusField
    ? (entity?.fields[statusField]?.values ?? [])
    : [];

  const cardBadges: object[] = [];
  if (priorityField) {
    cardBadges.push({ type: "badge", binding: { kind: "binding", entity: entityName, field: priorityField, format: "priority" } });
  }
  if (dateField) {
    cardBadges.push({ type: "badge", binding: { kind: "binding", entity: entityName, field: dateField, format: "relative-date" } });
  }

  const cardFields: object[] = fields
    .filter((f) => f !== titleField && f !== descField && f !== priorityField && f !== dateField && f !== statusField)
    .slice(0, 2)
    .map((f) => ({ type: "field", binding: { kind: "binding", entity: entityName, field: f }, label: entity?.fields[f]?.label ?? f }));

  const baseCard = {
    type: "card",
    title: { kind: "binding", entity: entityName, field: titleField },
    ...(descField ? { subtitle: { kind: "binding", entity: entityName, field: descField } } : {}),
    ...(cardBadges.length ? { badges: cardBadges } : {}),
    ...(cardFields.length ? { fields: cardFields } : {}),
  };

  // Build mutations actions if available
  const firstMutation = schema.mutations ? Object.entries(schema.mutations)[0] : null;
  if (firstMutation) {
    const [mutName, mut] = firstMutation;
    const idArg = Object.entries(mut.args).find(([, v]) => v.type === "string" || v.type === "id")?.[0] ?? "id";
    (baseCard as Record<string, unknown>).actions = [{
      type: "action",
      label: mut.label ?? "Update",
      mutation: mutName,
      args: { [idArg]: { kind: "binding", entity: entityName, field: "id" } },
      style: "secondary",
    }];
  }

  let rootNode: object;

  if (wantsKanban && statusField && statusValues.length >= 2) {
    rootNode = {
      type: "kanban",
      query: { entity: entityName },
      groupBy: statusField,
      columns: statusValues,
      card: baseCard,
    };
  } else {
    rootNode = {
      type: "list",
      query: { entity: entityName },
      variant: "comfortable",
      item: baseCard,
      emptyText: "No items found.",
    };
  }

  const ir = {
    version: 1 as const,
    archetype: "auto-fallback",
    schema: schema.name,
    root: {
      type: "stack" as const,
      direction: "col" as const,
      gap: "md" as const,
      children: [
        { type: "heading", text: entityName + "s", level: 1 },
        rootNode,
      ],
    },
  };

  return ir as unknown as FluidIR;
}

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
      // Strip <think>...</think> reasoning blocks some models emit
      const text = result.text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      try {
        const parsed = parseIR(text);
        const validated = validateIR(parsed);
        checkIRAgainstSchema(validated, opts.schema);
        await cache.set(key, validated);
        return validated;
      } catch (err) {
        lastError = err;
        userMessage = buildRetryMessage(opts.intent, err);
      }
    }

    // All LLM attempts failed — build a valid IR programmatically so the
    // user always gets a working UI instead of an error screen.
    console.warn(`[fluid] LLM failed after ${MAX_RETRIES + 1} attempts, using fallback IR. Last error: ${errMsg(lastError)}`);
    const fallback = buildFallbackIR(opts.schema, opts.intent);
    await cache.set(key, fallback);
    return fallback;
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
