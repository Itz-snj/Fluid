import { NextRequest, NextResponse } from "next/server";
import type { UsageEvent } from "@fluid-genui/engine";
import { getEngine } from "@/lib/engine";

/**
 * POST /api/telemetry
 *
 * Record usage events for analytics and AI suggestions.
 *
 * Body: { events: UsageEvent[] } — exactly the payload the @fluid-genui/react
 * `useFluidTelemetry` hook sends.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const events = body?.events;

  if (!Array.isArray(events)) {
    return NextResponse.json(
      { error: "events array is required" },
      { status: 400 }
    );
  }

  const engine = getEngine();

  try {
    await engine.usageTracker.recordBatch(events as UsageEvent[]);
    return NextResponse.json({ ok: true, recorded: events.length });
  } catch (err) {
    console.error("[telemetry] Error recording events:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
