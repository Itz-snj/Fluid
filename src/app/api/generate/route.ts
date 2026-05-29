import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, generateIR, intentKey } from "@/fluid/engine";
import { taskSchema } from "@/schemas/tasks.fluid";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERVER_TIMEOUT_MS = 90_000;
const RATE = { limit: 20, windowMs: 60_000 };

const BodySchema = z.object({
  intent: z.string().min(1, "intent must be non-empty").max(2000, "intent too long"),
  bypassCache: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIP(req);

  const rl = checkRateLimit(`gen:${ip}`, RATE);
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
  const { intent, bypassCache } = parsed.data;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SERVER_TIMEOUT_MS);
  // Abort if the client disconnects.
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });

  const key = intentKey(taskSchema.name, intent);
  try {
    const result = await generateIR({
      schema: taskSchema,
      intent,
      bypassCache: bypassCache === true,
      signal: ac.signal,
    });
    const latencyMs = Date.now() - started;
    logGeneration({
      ok: true,
      ip,
      key,
      cached: result.cached,
      attempts: result.attempts,
      latencyMs,
      usage: result.usage,
    });
    return NextResponse.json({
      ir: result.ir,
      cached: result.cached,
      usage: result.usage,
      latencyMs,
      attempts: result.attempts,
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
  cached?: boolean;
  attempts?: number;
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
  // Structured single-line JSON log for easy ingestion.
  const payload = { at: new Date().toISOString(), scope: "fluid.generate", ...log };
  if (log.ok) {
    console.log(JSON.stringify(payload));
  } else {
    console.error(JSON.stringify(payload));
  }
}
