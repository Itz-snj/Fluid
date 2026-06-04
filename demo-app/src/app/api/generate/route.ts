import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { intentKey } from "@fluid/engine";
import { demoSchema } from "@/schemas/demo.fluid";
import { getEngine, getDb } from "@/lib/engine";
import { createSnapshot } from "@fluid/db";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERVER_TIMEOUT_MS = 90_000;

const BodySchema = z
  .object({
    intent: z.string().min(1, "intent required").max(2000, "intent too long"),
    bypassCache: z.boolean().optional(),
    userId: z.string().min(1).max(128).optional(),
    learn: z.boolean().optional(),
    // Context signals for prompt enrichment
    role: z.string().max(64).optional(),
    device: z.enum(["mobile", "tablet", "desktop"]).optional(),
    currentUserName: z.string().max(128).optional(),
  })
  .refine((b) => !b.learn || !!b.userId, {
    message: "learn=true requires a userId",
    path: ["learn"],
  });

/**
 * POST /api/generate
 *
 * Generate IR from natural language intent.
 *
 * Features:
 * - Rate limiting (20 req/min per IP)
 * - Intent caching (1h TTL)
 * - Learning loop (when learn=true)
 * - Context enrichment (role, device)
 * - Snapshot creation (for version history)
 * - Background refresh scheduling
 * - Abort on timeout or client disconnect
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIP(req);

  // Get engine (throws if API key missing)
  let engine;
  try {
    engine = getEngine();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Rate limiting
  const rl = await engine.checkRateLimit(`gen:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        detail: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }

  const { intent, bypassCache, userId, learn, role, device, currentUserName } = parsed.data;

  const contextSignals =
    role || device || currentUserName ? { role, device, currentUserName } : undefined;

  // Abort controller for timeout + client disconnect
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SERVER_TIMEOUT_MS);
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });

  const key = intentKey(demoSchema.name, intent, userId);

  try {
    // Learning loop (refine) or stateless generation
    const refined = learn
      ? await engine.refine({
          schema: demoSchema,
          intent,
          userId: userId!,
          bypassCache: bypassCache === true,
          signal: ac.signal,
          contextSignals,
        })
      : null;

    const result =
      refined ??
      (await engine.generate({
        schema: demoSchema,
        intent,
        userId,
        bypassCache: bypassCache === true,
        signal: ac.signal,
      }));

    const latencyMs = Date.now() - started;
    const profile = refined?.profile ?? null;

    logGeneration({
      ok: true,
      ip,
      key,
      learn: !!learn,
      cached: result.cached,
      attempts: result.attempts,
      latencyMs,
      usage: result.usage,
      historyLen: profile?.history.length,
    });

    // Create snapshot for version history (best-effort)
    let snapshotId: string | undefined;
    if (userId && result.ir) {
      try {
        const db = getDb();
        const snapshot = await createSnapshot(db, {
          userId,
          schemaName: demoSchema.name,
          irJson: result.ir,
          source: "generate",
          changeDesc: learn
            ? "Generated from refined intent"
            : `Generated: "${intent.slice(0, 80)}"`,
        });
        snapshotId = snapshot.id;
      } catch (err) {
        console.warn("[fluid] Snapshot creation failed:", err);
      }
    }

    // Background refresh check (best-effort)
    if (userId && result.cached) {
      void engine
        .checkRefresh({
          userId,
          schemaName: demoSchema.name,
          lastGeneratedAt: Date.now() - latencyMs,
        })
        .then((decision) => {
          if (decision.refresh) {
            console.log(`[fluid] Refresh recommended for user ${userId}: ${decision.reason}`);
            // In production, enqueue a background job here
          }
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ir: result.ir,
      cached: result.cached,
      usage: result.usage,
      latencyMs,
      attempts: result.attempts,
      profile,
      snapshotId,
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    const aborted = ac.signal.aborted;

    logGeneration({ ok: false, ip, key, latencyMs, error: message, aborted });

    if (aborted) {
      return NextResponse.json(
        { error: "Generation timed out or was aborted", detail: message },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "IR generation failed", detail: message },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}

function clientIP(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

interface GenLog {
  ok: boolean;
  ip: string;
  key: string;
  latencyMs: number;
  learn?: boolean;
  cached?: boolean;
  attempts?: number;
  historyLen?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
  error?: string;
  aborted?: boolean;
}

function logGeneration(log: GenLog): void {
  const payload = { at: new Date().toISOString(), scope: "fluid.generate", ...log };
  if (log.ok) {
    console.log(JSON.stringify(payload));
  } else {
    console.error(JSON.stringify(payload));
  }
}
