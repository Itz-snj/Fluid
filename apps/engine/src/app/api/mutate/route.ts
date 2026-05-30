import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { taskSchema } from "@/schemas/tasks.fluid";

export const runtime = "nodejs";

const BodySchema = z.object({
  mutation: z.string().min(1).max(128),
  args: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/mutate
 *
 * Executes a developer-declared mutation from the schema.
 * The LLM places action buttons in the IR with `mutation` and `args` attrs.
 * The client's `useMutations` hook POSTs here when those buttons are clicked.
 *
 * Security:
 *   - Only mutations declared in `taskSchema.mutations` can be called.
 *   - Required args are validated before the handler runs.
 *   - The handler itself runs server-side only.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request", detail: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const { mutation, args } = parsed.data;

  const def = (taskSchema.mutations as Record<string, import("@fluid/core").MutationDef> | undefined)?.[mutation];
  if (!def) {
    return NextResponse.json(
      { ok: false, error: `Unknown mutation "${mutation}"` },
      { status: 404 },
    );
  }

  // Validate required args.
  for (const [argName, argSpec] of Object.entries(def.args) as [string, { type: string; required?: boolean }][]) {
    if (argSpec.required && !(argName in args)) {
      return NextResponse.json(
        { ok: false, error: `Missing required argument: "${argName}"` },
        { status: 400 },
      );
    }
  }

  try {
    const result = await def.handler(args);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fluid.mutate] "${mutation}" threw:`, message);
    return NextResponse.json({ ok: false, error: "Mutation failed" }, { status: 500 });
  }
}
