import { NextRequest, NextResponse } from "next/server";
import { generateIR } from "@/fluid/engine";
import { taskSchema } from "@/schemas/tasks.fluid";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { intent, bypassCache } = body as { intent?: unknown; bypassCache?: unknown };
  if (typeof intent !== "string" || intent.trim().length === 0) {
    return NextResponse.json({ error: "Field 'intent' (string) is required" }, { status: 400 });
  }
  if (intent.length > 2000) {
    return NextResponse.json({ error: "Intent too long (max 2000 chars)" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const started = Date.now();
  try {
    const result = await generateIR({
      schema: taskSchema,
      intent,
      bypassCache: bypassCache === true,
    });
    return NextResponse.json({
      ir: result.ir,
      cached: result.cached,
      usage: result.usage,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/generate] failed:", message);
    return NextResponse.json(
      { error: "IR generation failed", detail: message },
      { status: 502 },
    );
  }
}
