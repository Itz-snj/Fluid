import { NextRequest, NextResponse } from "next/server";
import { getEngine } from "@/lib/engine";

/**
 * POST /api/telemetry
 *
 * Record usage events for analytics and AI suggestions.
 *
 * Events tracked:
 * - view: User viewed a UI section
 * - interact: User interacted with an element
 * - dwell: Time spent on a section
 *
 * Body:
 * - userId (required)
 * - events: Array of { type, nodeType, nodeId, duration?, timestamp }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, events } = body;

  if (!userId || !Array.isArray(events)) {
    return NextResponse.json(
      { error: "userId and events array are required" },
      { status: 400 }
    );
  }

  const engine = getEngine();

  try {
    // Track each event
    for (const event of events) {
      await engine.trackUsage({
        userId,
        schemaName: "demo",
        eventType: event.type || "view",
        nodeType: event.nodeType,
        nodeId: event.nodeId,
        duration: event.duration,
        timestamp: event.timestamp || Date.now(),
      });
    }

    return NextResponse.json({ ok: true, recorded: events.length });
  } catch (err) {
    console.error("[telemetry] Error recording events:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
