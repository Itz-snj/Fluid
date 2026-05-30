/**
 * System prompt for conversational IR patching.
 *
 * Unlike buildSystemPrompt() which generates IR from scratch, this prompt
 * takes an EXISTING IR + a change request and produces a modified IR.
 * The schema is included so the LLM knows the sandbox boundaries.
 */

import type { FluidSchema } from "@fluid/core";
import type { FluidIR } from "@fluid/core";

export interface PatchChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildPatchPrompt(
  schema: FluidSchema,
  currentIR: FluidIR,
  chatHistory: PatchChatMessage[],
): { systemPrompt: string; userMessage: string } {
  const schemaJson = JSON.stringify(serializePatchSchema(schema), null, 2);
  const irJson = JSON.stringify(currentIR, null, 2);

  // Only include the last 10 messages to keep costs bounded.
  const recentHistory = chatHistory.slice(-10);
  const historyBlock = recentHistory.length > 0
    ? `\n\nRecent conversation:\n${recentHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}`
    : "";

  const systemPrompt = `You are Fluid, a UI layout editor. The user is looking at a rendered UI and wants to make a specific change. You will receive the current IR (what the user sees) and a change request.

# Output format

You MUST respond with exactly ONE of these three JSON shapes. No prose. No code fences. Pure JSON only.

## 1. Successful edit — output the COMPLETE modified IR:
{"version":1,"archetype":"...","schema":"${schema.name}","root":{...}}

## 2. Impossible change — the request violates schema constraints:
{"canApply":false,"reason":"Human-readable explanation of why this change is not possible"}

## 3. Ambiguous request — you need clarification:
{"clarify":"A question asking the user to clarify their intent"}

# Rules

1. When editing: output the COMPLETE modified IR. Same structure, same format. Only change what the user asked for. Preserve EVERYTHING else exactly as-is.
2. You may: reorder sections, change layout types (list↔kanban↔grid), add nodes, remove nodes, change queries, swap variants, adjust grouping/sorting, modify filters, change gap/direction, add/remove fields/badges/actions from cards.
3. You may NOT: reference entities or fields not in the schema. Invent new data that doesn't exist. Change the schema name or version number.
4. The modified IR must still pass validation — same entities, fields, enums as declared.
5. If the user asks to "move X to the top", reorder children in the root stack so X comes first.
6. If the user asks to "remove X", delete that node from the tree.
7. If the user asks to "make X bigger" or "emphasize X", consider changing it from compact→comfortable, or from list→kanban, or increasing its visual weight.
8. Preserve all action nodes (mutation buttons) unless the user specifically asks to remove them.

# Schema constraints (the sandbox — you CANNOT reference anything outside this)

\`\`\`json
${schemaJson}
\`\`\`

# Current IR (what the user sees right now)

\`\`\`json
${irJson}
\`\`\`${historyBlock}`;

  // The actual user message is set by the caller (the latest chat message).
  // We return it separately so the provider receives it as the user turn.
  const userMessage = "Apply the user's latest change request. Output only JSON.";

  return { systemPrompt, userMessage };
}

function serializePatchSchema(schema: FluidSchema) {
  return {
    name: schema.name,
    entities: Object.fromEntries(
      Object.entries(schema.entities).map(([name, entity]) => [
        name,
        {
          label: entity.label,
          fields: Object.fromEntries(
            Object.entries(entity.fields).map(([fname, f]) => [
              fname,
              { type: f.type, values: f.values, label: f.label },
            ]),
          ),
        },
      ]),
    ),
    endpoints: Object.fromEntries(
      Object.entries(schema.endpoints).map(([name, ep]) => [
        name,
        { entity: ep.entity },
      ]),
    ),
    mutations: schema.mutations
      ? Object.fromEntries(
          Object.entries(schema.mutations).map(([name, m]) => [
            name,
            {
              entity: m.entity,
              args: Object.fromEntries(
                Object.entries(m.args).map(([k, v]) => [k, { type: v.type, required: v.required }]),
              ),
              label: m.label,
            },
          ]),
        )
      : undefined,
  };
}
