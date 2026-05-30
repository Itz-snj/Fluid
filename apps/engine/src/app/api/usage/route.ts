import { NextRequest, NextResponse } from "next/server";
import { getEngine } from "@/lib/engine";
import { taskSchema } from "@/schemas/tasks.fluid";

export const runtime = "nodejs";

/**
 * GET /api/usage?userId=...&windowDays=7
 *
 * Returns the usage summary for a given user.
 * Used by the frontend "Usage insights" panel to show what Fluid has learned.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }
  const windowDays = parseInt(req.nextUrl.searchParams.get("windowDays") ?? "7", 10);

  try {
    const engine = getEngine();
    const summary = await engine.usageTracker.summarize(userId, taskSchema.name, windowDays);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[fluid.usage] summarize failed:", err);
    return NextResponse.json({ summary: null, error: "Failed to summarise usage" });
  }
}
