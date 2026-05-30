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

  const recentHistory = chatHistory.slice(-6);
  const historyBlock = recentHistory.length > 0
    ? `\n\nRecent conversation:\n${recentHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}`
    : "";

  const systemPrompt = `You are a UI layout editor. Modify the given IR JSON based on the user's request.

RULES:
1. Output ONLY valid JSON — no prose, no code fences, no comments.
2. Output ONE of these three shapes:
   A) Modified IR: {"version":1,"archetype":"...","schema":"${schema.name}","root":{...}}
   B) Impossible: {"canApply":false,"reason":"..."}
   C) Unclear: {"clarify":"...your question..."}
3. For shape A: output the COMPLETE IR with ONLY the requested change. Preserve everything else exactly.
4. ONLY reference entities/fields from the schema below.
5. Do NOT change version number or schema name.

SCHEMA:
\`\`\`json
${schemaJson}
\`\`\`

CURRENT IR:
\`\`\`json
${irJson}
\`\`\`${historyBlock}`;

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
