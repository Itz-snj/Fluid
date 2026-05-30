/**
 * Incremental IR patching — the core of the chatbot's edit capability.
 *
 * Unlike generateIR() which creates an IR from scratch, patchIR() takes
 * an existing IR + a natural-language change request and produces a
 * modified IR. The LLM outputs the COMPLETE modified IR (not JSON patches)
 * because LLMs are unreliable at producing correct RFC 6902 operations.
 *
 * Three possible outcomes:
 *   1. canApply: true  — returns the modified IR
 *   2. canApply: false — the change violates schema constraints
 *   3. clarify         — the request is ambiguous, needs user input
 */

import {
  type FluidIR,
  type FluidSchema,
  checkIRAgainstSchema,
  IRSemanticError,
  validateIR,
} from "@fluid/core";
import type { LLMProvider } from "./llm";
import { buildPatchPrompt, type PatchChatMessage } from "./patch-prompt";

export interface PatchIROptions {
  schema: FluidSchema;
  /** The IR the user is currently seeing. */
  currentIR: FluidIR;
  /** The user's change request in natural language. */
  message: string;
  /** Recent chat history for conversational context. */
  chatHistory?: PatchChatMessage[];
  /** Optional abort signal. */
  signal?: AbortSignal;
}

export interface PatchIRResult {
  /** Whether the change was applied successfully. */
  canApply: boolean;
  /** The modified IR (only present when canApply is true). */
  newIR?: FluidIR;
  /** Human-readable explanation of what changed or why it can't be done. */
  explanation: string;
  /** If the request is ambiguous, a clarifying question. */
  clarify?: string;
  /** Token usage for monitoring. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
}

interface PatchIRDeps {
  provider: LLMProvider;
}

const MAX_RETRIES = 2;

/**
 * Try simple programmatic patches before hitting the LLM.
 * Handles: kanban column reorder requests.
 */
function tryProgrammaticPatch(ir: FluidIR, message: string): FluidIR | null {
  const msg = message.toLowerCase();

  // Detect "X over/before Y" or "move X to top" for kanban columns
  const root = ir.root as Record<string, unknown>;

  // Find kanban node (direct root or in a stack)
  const findKanban = (node: unknown): Record<string, unknown> | null => {
    if (!node || typeof node !== "object") return null;
    const n = node as Record<string, unknown>;
    if (n.type === "kanban") return n;
    if (Array.isArray(n.children)) {
      for (const c of n.children) { const r = findKanban(c); if (r) return r; }
    }
    return null;
  };

  const kanban = findKanban(root);
  if (!kanban || !Array.isArray(kanban.columns)) return null;

  const cols: string[] = kanban.columns as string[];

  // Pattern: "[colA] over [colB]" or "put [colA] before [colB]"
  for (const colA of cols) {
    for (const colB of cols) {
      if (colA === colB) continue;
      const aName = colA.replace(/_/g, " ").toLowerCase();
      const bName = colB.replace(/_/g, " ").toLowerCase();
      if (
        (msg.includes(aName) && msg.includes(bName)) &&
        (msg.includes("over") || msg.includes("before") || msg.includes("above"))
      ) {
        // Move colA before colB
        const newCols = cols.filter((c) => c !== colA);
        const bIdx = newCols.indexOf(colB);
        newCols.splice(bIdx, 0, colA);
        return JSON.parse(JSON.stringify({
          ...ir,
          root: patchNodeKanbanCols(root, colA, newCols),
        })) as FluidIR;
      }
    }
  }

  return null;
}

function patchNodeKanbanCols(
  node: Record<string, unknown>,
  _colA: string,
  newCols: string[],
): Record<string, unknown> {
  if (node.type === "kanban") {
    return { ...node, columns: newCols };
  }
  if (Array.isArray(node.children)) {
    return {
      ...node,
      children: (node.children as Record<string, unknown>[]).map((c) =>
        patchNodeKanbanCols(c, _colA, newCols)
      ),
    };
  }
  return node;
}

/**
 * Patch an existing IR based on a conversational change request.
 */
export async function patchIR(
  opts: PatchIROptions,
  deps: PatchIRDeps,
): Promise<PatchIRResult> {
  const { provider } = deps;

  // ── Fast path: try programmatic patch first ──────────────────
  try {
    const programmatic = tryProgrammaticPatch(opts.currentIR, opts.message);
    if (programmatic) {
      validateIR(programmatic);
      checkIRAgainstSchema(programmatic, opts.schema);
      return {
        canApply: true,
        newIR: programmatic,
        explanation: `Done! Applied your change: "${opts.message}"`,
        usage: null,
      };
    }
  } catch { /* fall through to LLM */ }

  // Append the user's current message to the chat history for context.
  const chatHistory: PatchChatMessage[] = [
    ...(opts.chatHistory ?? []),
    { role: "user", content: opts.message },
  ];

  const { systemPrompt, userMessage } = buildPatchPrompt(
    opts.schema,
    opts.currentIR,
    chatHistory,
  );

  let usage: PatchIRResult["usage"] = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (opts.signal?.aborted) {
      throw new Error("Patch aborted");
    }

    const currentUserMessage = attempt === 0
      ? `User request: ${opts.message}\n\n${userMessage}`
      : buildRetryMessage(opts.message, lastError);

    const result = await provider.generate({
      systemPrompt,
      userMessage: currentUserMessage,
      signal: opts.signal,
    });
    usage = result.usage;
    // Strip <think>...</think> tags that some models emit
    result.text = result.text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    try {
      const parsed = parseResponse(result.text);

      // Check for rejection response.
      if ("canApply" in parsed && parsed.canApply === false) {
        return {
          canApply: false,
          explanation: (parsed.reason as string) || "The requested change is not possible.",
          usage,
        };
      }

      // Check for clarification response.
      if ("clarify" in parsed && typeof parsed.clarify === "string") {
        return {
          canApply: false,
          explanation: parsed.clarify,
          clarify: parsed.clarify,
          usage,
        };
      }

      // Attempt to validate as a modified IR.
      const validated = validateIR(parsed);
      checkIRAgainstSchema(validated, opts.schema);

      return {
        canApply: true,
        newIR: validated,
        explanation: inferExplanation(opts.currentIR, validated, opts.message),
        usage,
      };
    } catch (err) {
      lastError = err;
      // On last attempt, return as a rejection rather than throwing.
      if (attempt >= MAX_RETRIES) {
        return {
          canApply: false,
          explanation: `I tried to make that change but the result didn't pass validation: ${errMsg(err)}`,
          usage,
        };
      }
    }
  }

  // Should not reach here, but just in case.
  return {
    canApply: false,
    explanation: "Unexpected error during patching.",
    usage,
  };
}

/**
 * Best-effort JSON extraction (same logic as generate.ts).
 */
function parseResponse(text: string): Record<string, unknown> {
  const cleaned = text.trim();

  // Direct parse.
  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  // Strip code fences.
  if (cleaned.startsWith("```")) {
    const stripped = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      return JSON.parse(stripped);
    } catch { /* fall through */ }
  }

  // Find balanced JSON.
  const balanced = extractBalancedJSON(cleaned);
  if (balanced) return JSON.parse(balanced);

  return JSON.parse(cleaned);
}

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
    if (c === '"') { inString = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function buildRetryMessage(originalMessage: string, err: unknown): string {
  const message = errMsg(err);
  const kind =
    err instanceof IRSemanticError
      ? "schema-violation"
      : err instanceof SyntaxError
        ? "invalid-json"
        : "invalid-ir";
  return `User request: ${originalMessage}\n\nYour previous response failed (${kind}):\n${message}\n\nReturn ONLY the corrected IR JSON. No prose, no code fences. Only reference entities and fields declared in the schema.`;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Infer a human-readable explanation of what changed between two IRs.
 * This is a best-effort heuristic — not a full diff.
 */
function inferExplanation(oldIR: FluidIR, newIR: FluidIR, message: string): string {
  // Simple: if the archetype changed, mention it.
  if (oldIR.archetype !== newIR.archetype) {
    return `Applied your change and updated the layout from "${oldIR.archetype}" to "${newIR.archetype}".`;
  }

  // Count nodes in old vs new.
  const oldCount = countNodes(oldIR.root);
  const newCount = countNodes(newIR.root);

  if (newCount > oldCount) {
    return `Done! Added ${newCount - oldCount} new section(s) to the layout.`;
  } else if (newCount < oldCount) {
    return `Done! Removed ${oldCount - newCount} section(s) from the layout.`;
  }

  return `Done! Applied your change: "${message}"`;
}

function countNodes(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  const n = node as Record<string, unknown>;
  let count = 1;
  if (Array.isArray(n.children)) {
    for (const c of n.children) count += countNodes(c);
  }
  if (n.left) count += countNodes(n.left);
  if (n.right) count += countNodes(n.right);
  if (n.item) count += countNodes(n.item);
  if (n.card) count += countNodes(n.card);
  if (Array.isArray(n.fields)) {
    for (const f of n.fields) count += countNodes(f);
  }
  if (Array.isArray(n.badges)) {
    for (const b of n.badges) count += countNodes(b);
  }
  if (Array.isArray(n.actions)) {
    for (const a of n.actions) count += countNodes(a);
  }
  return count;
}
