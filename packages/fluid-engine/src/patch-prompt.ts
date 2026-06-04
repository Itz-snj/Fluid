/**
 * System prompt for conversational IR patching.
 *
 * Unlike buildSystemPrompt() which generates IR from scratch, this prompt
 * takes an EXISTING IR + a change request and produces a modified IR.
 * The schema is included so the LLM knows the sandbox boundaries.
 */

import type { FluidSchema } from "@fluid-genui/core";
import type { FluidIR } from "@fluid-genui/core";

export interface PatchChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildPatchPrompt(
  schema: FluidSchema,
  currentIR: FluidIR,
  chatHistory: PatchChatMessage[],
): { systemPrompt: string; userMessage: string } {
  const schemaJson = JSON.stringify(serializePatchSchema(schema)); // minified
  const irJson = JSON.stringify(currentIR); // minified — saves ~40% tokens vs pretty-print

  // Trim to last 4 messages to keep prompt small
  const recentHistory = chatHistory.slice(-4);
  const historyBlock = recentHistory.length > 0
    ? `\n\nRecent conversation:\n${recentHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}`
    : "";

  const systemPrompt = `You are a UI layout editor. Modify the CURRENT IR based on the user's request and output a new valid IR.

OUTPUT RULES:
- Output ONE JSON object only. No prose, no markdown, no code fences.
- Shape A (applied change): {"version":1,"archetype":"...","schema":"${schema.name}","root":{...}}
- Shape B (impossible): {"canApply":false,"reason":"..."}
- Shape C (ambiguous): {"clarify":"..."}
- Preserve schema name "${schema.name}" and version 1 exactly.
- Only reference entities/fields declared in SCHEMA below.

NODE TYPE REFERENCE — use these exact structures:

list node (for "show as list", "show all", "table view"):
{"type":"list","query":{"entity":"ENTITY"},"variant":"comfortable","item":{"type":"card","title":{"kind":"binding","entity":"ENTITY","field":"FIELD"},"badges":[{"type":"badge","binding":{"kind":"binding","entity":"ENTITY","field":"FIELD"}}]}}

kanban node (for "kanban", "board", "group by status"):
{"type":"kanban","query":{"entity":"ENTITY"},"groupBy":"FIELD","columns":["val1","val2"],"card":{"type":"card","title":{"kind":"binding","entity":"ENTITY","field":"FIELD"}}}

stack node (wrapper, for multi-section layouts):
{"type":"stack","direction":"col","gap":"md","children":[...nodes...]}

grid node (for "grid view", "card grid"):
{"type":"grid","cols":3,"children":[...card nodes...]}

stat node (for summary numbers):
{"type":"stat","label":"Total Tasks","query":{"entity":"ENTITY"},"aggregate":"count"}

CRITICAL field-name rules:
- stack/grid use "children" (array) — NEVER "items"
- list uses "query" + "item" — NEVER "children"
- kanban uses "query" + "groupBy" + "columns" + "card" — all four required
- Bindings: {"kind":"binding","entity":"...","field":"..."} — use "kind" NOT "type"
- card.badges items: {"type":"badge","binding":{...}} — "binding" key, not "field"

SCHEMA: ${schemaJson}

CURRENT IR: ${irJson}${historyBlock}`;

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
