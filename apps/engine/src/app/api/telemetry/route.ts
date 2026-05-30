import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEngine } from "@/lib/engine";

export const runtime = "nodejs";

const UsageEventSchema = z.object({
  userId: z.string().min(1).max(128),
  schemaName: z.string().min(1).max(64),
  irId: z.string().optional(),
  nodeType: z.string().min(1).max(64),
  nodeId: z.string().optional(),
  entity: z.string().optional(),
  action: z.enum(["click", "view", "scroll", "expand", "collapse", "dismiss"]),
  device: z.enum(["mobile", "desktop"]).optional(),
  viewportWidth: z.number().int().positive().optional(),
  timestamp: z.number().int().positive(),
});

const BodySchema = z.object({
  events: z.array(UsageEventSchema).min(1).max(200),
});

/**
 * POST /api/telemetry
 *
 * Receives batched usage events from the client `useFluidTelemetry` hook.
 * Validates and forwards to the engine's UsageTracker.
 * Always returns 200 — telemetry failure must never degrade the UI.
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
      { ok: false, error: "Invalid events payload" },
      { status: 400 },
    );
  }

  try {
    const engine = getEngine();
    await engine.usageTracker.recordBatch(parsed.data.events);
  } catch (err) {
    // Log but don't fail — telemetry must not block the caller.
    console.error("[fluid.telemetry] recordBatch failed:", err);
  }

  return NextResponse.json({ ok: true, received: parsed.data.events.length });
}
