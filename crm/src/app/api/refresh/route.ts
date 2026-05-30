import { NextRequest, NextResponse } from "next/server";
import { getEngine, getDb } from "@/lib/engine";
import { crmSchema } from "@/schemas/crm.fluid";
import { dequeueRefreshJobs, completeRefreshJob } from "@fluid/db";
import type { IntentProfile, UsageSummary } from "@fluid/engine";

export const runtime = "nodejs";
// Allow up to 5 minutes for the refresh worker to complete its batch.
export const maxDuration = 300;

/**
 * POST /api/refresh
 *
 * Background re-generation worker.
 *
 * Dequeues up to `limit` pending refresh jobs, re-generates the IR for each
 * user using their full profile + usage summary, and marks the job complete.
 *
 * Protected by the REFRESH_SECRET header — set this in your environment
 * and pass it as `Authorization: Bearer <secret>` from your cron config.
 */
export async function POST(req: NextRequest) {
  // Optional auth check for the cron caller.
  const secret = process.env.REFRESH_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5", 10), 20);

  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL not configured — refresh worker requires a database." },
      { status: 503 },
    );
  }

  const engine = getEngine();
  const jobs = await dequeueRefreshJobs(db, limit);

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, results: [] });
  }

  const results: Array<{
    userId: string;
    ok: boolean;
    cached?: boolean;
    error?: string;
  }> = [];

  for (const job of jobs) {
    try {
      // 1. Load profile and usage summary.
      const profile: IntentProfile = (await engine.profileStore.get(job.userId)) ?? {
        userId: job.userId,
        history: [],
        updatedAt: 0,
      };
      const usageSummary: UsageSummary | null = await engine.usageTracker.summarize(
        job.userId,
        job.schemaName,
        7,
      );

      // 2. Build a targeted refresh intent.
      const intent = buildRefreshIntent(profile, usageSummary, job.reason);

      // 3. Re-generate bypassing the stale cache.
      const result = await engine.refine({
        schema: crmSchema,
        intent,
        userId: job.userId,
        bypassCache: true,
      });

      await completeRefreshJob(db, job.userId, job.schemaName);
      results.push({ userId: job.userId, ok: true, cached: result.cached });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fluid.refresh] failed for user ${job.userId}:`, message);
      results.push({ userId: job.userId, ok: false, error: message });
      // Don't mark as complete — it will be retried on the next cron run.
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

/**
 * Constructs the intent string used when re-generating without an explicit
 * user request. Incorporates the last known preference and usage signal.
 */
function buildRefreshIntent(
  profile: IntentProfile,
  usageSummary: UsageSummary | null,
  reason: string,
): string {
  const parts: string[] = [];

  if (profile.history.length > 0) {
    const last = profile.history[profile.history.length - 1];
    parts.push(`Continue from the user's last preference: "${last.intent}".`);
  } else {
    parts.push("Show the user a sensible default workspace for their data.");
  }

  parts.push(`Refresh triggered because: ${reason}.`);

  if (usageSummary && usageSummary.totalEvents >= 10) {
    parts.push(
      "Remove sections the user has never interacted with. " +
        "Prioritise sections with the most interactions.",
    );
  }

  return parts.join(" ");
}
