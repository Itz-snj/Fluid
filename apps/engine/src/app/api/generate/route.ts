import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { intentKey } from "@fluid-genui/engine";
import { taskSchema } from "@/schemas/tasks.fluid";
import { getEngine, getDb } from "@/lib/engine";
import { enqueueRefreshJob, createSnapshot } from "@fluid-genui/db";

export const runtime = "nodejs";

export const maxDuration = 120;

const SERVER_TIMEOUT_MS = 90_000;

const BodySchema = z
  .object({
    intent: z.string().min(1, "intent must be non-empty").max(2000, "intent too long"),
    bypassCache: z.boolean().optional(),
    userId: z.string().min(1).max(128).optional(),
    /** When true, run the learning loop (engine.refine). Requires userId. */
    learn: z.boolean().optional(),
    // Context signals — forwarded to the ContextEnricher
    role: z.string().max(64).optional(),
    device: z.enum(["mobile", "tablet", "desktop"]).optional(),
    currentUserName: z.string().max(128).optional(),
  })
  .refine((b) => !b.learn || !!b.userId, {
    message: "learn=true requires a userId",
    path: ["learn"],
  });

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIP(req);

  let engine;
  try {
    engine = getEngine();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const rl = await engine.checkRateLimit(`gen:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", detail: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { intent, bypassCache, userId, learn, role, device, currentUserName } = parsed.data;

  const contextSignals = (role || device || currentUserName)
    ? { role, device, currentUserName }
    : undefined;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SERVER_TIMEOUT_MS);
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });

  const key = intentKey(taskSchema.name, intent, userId);
  try {
    const refined = learn
      ? await engine.refine({
          schema: taskSchema,
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
        schema: taskSchema,
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

    // Fire-and-forget: create an IR snapshot for the chatbot version chain.
    let snapshotId: string | undefined;
    if (userId && result.ir) {
      try {
        const db = getDb();
        const snapshot = await createSnapshot(db, {
          userId,
          schemaName: taskSchema.name,
          irJson: result.ir,
          source: "generate",
          changeDesc: learn
            ? `Generated from refined intent`
            : `Generated from intent: "${intent.slice(0, 80)}"`,
        });
        snapshotId = snapshot.id;
      } catch {
        // DB might not be available in dev — snapshot creation is best-effort.
      }
    }

    // Fire-and-forget: check if the user's IR should be refreshed in the background.
    if (userId && result.cached) {
      void engine
        .checkRefresh({ userId, schemaName: taskSchema.name, lastGeneratedAt: Date.now() - latencyMs })
        .then((decision) => {
          if (decision.refresh) {
            try {
              const db = getDb();
              void enqueueRefreshJob(db, userId, taskSchema.name, decision.reason ?? "policy");
            } catch {
              // DB might not be available in dev — ignore.
            }
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
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "IR generation failed", detail: message },
      { status: 502 },
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
