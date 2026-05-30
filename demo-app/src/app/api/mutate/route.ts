import { NextRequest, NextResponse } from "next/server";
import { demoSchema } from "@/schemas/demo.fluid";

/**
 * POST /api/mutate
 *
 * Execute a schema-defined mutation (interactive action).
 *
 * Body:
 * - mutation: string (mutation name from schema)
 * - args: Record<string, unknown> (mutation arguments)
 *
 * Example:
 * {
 *   "mutation": "completeTask",
 *   "args": { "id": "t1" }
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mutation, args } = body;

  if (!mutation || !args) {
    return NextResponse.json(
      { error: "mutation and args are required" },
      { status: 400 }
    );
  }

  // Look up mutation in schema
  const mutationDef = demoSchema.mutations?.[mutation];
  if (!mutationDef) {
    return NextResponse.json(
      { error: `Mutation "${mutation}" not found in schema` },
      { status: 404 }
    );
  }

  try {
    // Execute mutation handler
    const result = await mutationDef.handler(args);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        message: result.message || "Mutation executed successfully",
      });
    } else {
      return NextResponse.json(
        { ok: false, error: result.error || "Mutation failed" },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error(`[mutate] Error executing ${mutation}:`, err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
