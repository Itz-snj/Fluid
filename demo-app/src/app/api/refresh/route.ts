import { NextRequest, NextResponse } from "next/server";
import { getEngine } from "@/lib/engine";

/**
 * POST /api/refresh
 *
 * Trigger a background IR refresh for a user.
 *
 * This is typically called by a background job scheduler when the
 * refresh policy determines a user's IR should be regenerated.
 *
 * Body:
 * - userId (required)
 * - schemaName (optional, defaults to "demo")
 * - reason (optional)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, schemaName = "demo", reason = "manual" } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const engine = getEngine();

  try {
    // Check if refresh is needed
    const decision = await engine.checkRefresh({
      userId,
      schemaName,
      lastGeneratedAt: Date.now() - 3600_000, // Assume 1h old
    });

    if (!decision.refresh) {
      return NextResponse.json({
        ok: false,
        message: "Refresh not needed",
        reason: decision.reason,
      });
    }

    // In a real implementation, you would:
    // 1. Load the user's last intent from profile
    // 2. Call engine.refine() to regenerate
    // 3. Store the new IR
    // 4. Notify the user (websocket, push notification, etc.)

    console.log(`[refresh] Would refresh IR for user ${userId}: ${reason}`);

    return NextResponse.json({
      ok: true,
      message: "Refresh scheduled",
      reason: decision.reason,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
