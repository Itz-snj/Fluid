"use client";

import { useEffect, useState } from "react";
import type { FluidIR } from "@fluid/core";
import {
  FluidView,
  type DataContext,
  useFluidTelemetry,
  useMutations,
} from "@fluid/react";

interface IntentBoxProps {
  data: DataContext;
}

interface IntentProfile {
  userId: string;
  history: { intent: string; at: number }[];
  updatedAt: number;
}

interface GenerateResponse {
  ir?: FluidIR;
  cached?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
  latencyMs?: number;
  attempts?: number;
  profile?: IntentProfile | null;
  error?: string;
  detail?: string;
}

interface UsageSummary {
  totalEvents: number;
  entityAffinities: Record<string, number>;
  hotNodeTypes: { type: string; entity?: string; count: number }[];
  coldNodeTypes: { type: string; entity?: string }[];
  inferredLayout?: string;
  inferredDensity?: string;
}

const SUGGESTIONS = [
  "I'm a designer juggling client briefs — show me task cards grouped by client with creative-brief snippets pinned alongside.",
  "I run support — show overdue tasks first as a tight checklist with assignees, hide everything that's done.",
  "I'm an exec — just give me a 4-tile summary of work in flight, then a single timeline of what's due this week.",
];

const ROLES = [
  { value: "", label: "No role" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "manager", label: "Manager" },
  { value: "engineer", label: "Engineer" },
  { value: "cs", label: "Customer Success" },
  { value: "exec", label: "Exec" },
  { value: "support", label: "Support" },
];

const USER_ID_KEY = "fluid.demo.userId";

function loadOrCreateUserId(): string {
  if (typeof window === "undefined") return "anon";
  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const fresh = `u_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(USER_ID_KEY, fresh);
  return fresh;
}

export function IntentBox({ data }: IntentBoxProps) {
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [showIR, setShowIR] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [learn, setLearn] = useState(true);
  const [userId, setUserId] = useState<string>("anon");
  const [profile, setProfile] = useState<IntentProfile | null>(null);
  const [role, setRole] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [currentIrId, setCurrentIrId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setUserId(loadOrCreateUserId());
  }, []);

  // ── Telemetry: collect click + view events from the rendered IR ──
  useFluidTelemetry({
    userId,
    schemaName: "tasks",
    irId: currentIrId,
    endpoint: "/api/telemetry",
    device: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop",
  });

  // ── Mutations: wire action buttons rendered by FluidView ──
  useMutations({
    endpoint: "/api/mutate",
    onSuccess: (mutation, args) => {
      console.log(`[fluid] mutation success: ${mutation}`, args);
      // Optionally re-fetch data here — for the in-memory demo, a full reload suffices.
    },
    onError: (mutation, error) => {
      console.error(`[fluid] mutation error: ${mutation}`, error.message);
    },
  });

  async function generate(text: string) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setCurrentIrId(undefined);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: text,
          learn,
          userId: learn ? userId : undefined,
          role: role || undefined,
          currentUserName: currentUserName || undefined,
          device:
            typeof window !== "undefined" && window.innerWidth < 768
              ? "mobile"
              : "desktop",
        }),
      });
      const body = (await resp.json()) as GenerateResponse;
      setResult(body);
      if (body.profile) setProfile(body.profile);
      // Assign a synthetic IR ID for telemetry correlation
      setCurrentIrId(`ir_${Date.now()}`);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsageSummary() {
    if (!userId || userId === "anon") return;
    try {
      const res = await fetch(`/api/usage?userId=${encodeURIComponent(userId)}&windowDays=7`);
      const json = (await res.json()) as { summary: UsageSummary | null };
      setUsageSummary(json.summary);
      setShowUsage(true);
    } catch {
      /* swallow */
    }
  }

  function forgetMe() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_ID_KEY);
    }
    setUserId(loadOrCreateUserId());
    setProfile(null);
    setResult(null);
    setUsageSummary(null);
    setCurrentIrId(undefined);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate(intent);
        }}
        className="flex flex-col gap-3"
      >
        <label className="text-xs uppercase tracking-wider text-zinc-400">
          Describe how you want to use this app
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g. I'm a designer — show me tasks grouped by client with brief snippets…"
            className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            disabled={loading}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={loading || !intent.trim()}
            className="rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 transition"
          >
            {loading ? "Generating…" : "Generate UI"}
          </button>
        </div>

        {/* Context signals row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          {/* Role selector */}
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-600">Role:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-1 text-xs focus:outline-none focus:border-zinc-600"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {/* User name for "my deals" resolution */}
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-600">Your name:</span>
            <input
              type="text"
              value={currentUserName}
              onChange={(e) => setCurrentUserName(e.target.value)}
              placeholder="e.g. Priya"
              className="rounded bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-1 text-xs w-24 focus:outline-none focus:border-zinc-600"
            />
          </label>

          {/* Learn toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={learn}
              onChange={(e) => setLearn(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>
              Remember preferences{" "}
              <span className="text-zinc-600">· {userId}</span>
            </span>
          </label>

          <button
            type="button"
            onClick={forgetMe}
            className="text-zinc-500 hover:text-rose-300 underline underline-offset-2 decoration-zinc-700"
          >
            forget me
          </button>

          <button
            type="button"
            onClick={() => void fetchUsageSummary()}
            className="text-zinc-500 hover:text-blue-300 underline underline-offset-2 decoration-zinc-700"
          >
            what has Fluid learned?
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setIntent(s);
                generate(s);
              }}
              disabled={loading}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 decoration-zinc-700 hover:decoration-zinc-400 transition"
            >
              Try: {s.split(" — ")[0]}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-400">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-zinc-500 animate-pulse" />
            Calling Claude · building IR · validating…
            {role && (
              <span className="text-zinc-600">· role: {role}</span>
            )}
          </div>
        </div>
      )}

      {result?.error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">
          <div className="font-medium mb-1">{result.error}</div>
          {result.detail && (
            <pre className="text-xs opacity-80 whitespace-pre-wrap mt-2">{result.detail}</pre>
          )}
        </div>
      )}

      {result?.ir && (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <div>
              {result.cached ? (
                <span className="text-emerald-400">cache hit</span>
              ) : (
                <>
                  generated in <span className="tabular-nums">{result.latencyMs}ms</span>
                  {result.usage && (
                    <>
                      {" · "}
                      <span className="tabular-nums">{result.usage.inputTokens}</span>
                      {" in / "}
                      <span className="tabular-nums">{result.usage.outputTokens}</span>
                      {" out"}
                      {result.usage.cacheReadTokens > 0 && (
                        <>
                          {" · "}
                          <span className="text-emerald-400 tabular-nums">
                            {result.usage.cacheReadTokens} cached
                          </span>
                        </>
                      )}
                      {result.attempts && result.attempts > 1 && (
                        <>
                          {" · "}
                          <span className="text-amber-400 tabular-nums">
                            {result.attempts} attempts
                          </span>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowIR((v) => !v)}
              className="hover:text-zinc-200"
            >
              {showIR ? "hide" : "show"} IR
            </button>
          </div>

          {showIR && (
            <pre className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300 overflow-auto max-h-96">
              {JSON.stringify(result.ir, null, 2)}
            </pre>
          )}

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-6">
            <FluidView ir={result.ir} data={data} />
          </div>
        </>
      )}

      {/* Usage insights panel */}
      {showUsage && (
        <div className="rounded-lg border border-blue-900 bg-blue-950/20 p-4 text-xs text-zinc-400">
          <div className="flex items-center justify-between mb-2">
            <div className="uppercase tracking-wider text-blue-400">
              What Fluid has learned about you (last 7 days)
            </div>
            <button
              type="button"
              onClick={() => setShowUsage(false)}
              className="text-zinc-600 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>

          {usageSummary === null ? (
            <p className="text-zinc-500 italic">
              Not enough usage data yet — interact with the generated UI first.
              Fluid needs at least 10 events before it starts adapting.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-zinc-500 mb-1">Most used</div>
                {usageSummary.hotNodeTypes.slice(0, 4).map((n, i) => (
                  <div key={i} className="text-zinc-300">
                    {n.type}{n.entity ? ` (${n.entity})` : ""} — {n.count} clicks
                  </div>
                ))}
              </div>
              <div>
                <div className="text-zinc-500 mb-1">Never touched</div>
                {usageSummary.coldNodeTypes.length === 0 ? (
                  <div className="text-zinc-600 italic">none</div>
                ) : (
                  usageSummary.coldNodeTypes.map((n, i) => (
                    <div key={i} className="text-rose-400">
                      {n.type}{n.entity ? ` (${n.entity})` : ""}
                    </div>
                  ))
                )}
              </div>
              {usageSummary.inferredLayout && (
                <div>
                  <div className="text-zinc-500 mb-1">Inferred layout preference</div>
                  <div className="text-emerald-400">{usageSummary.inferredLayout}</div>
                </div>
              )}
              {usageSummary.inferredDensity && (
                <div>
                  <div className="text-zinc-500 mb-1">Inferred density</div>
                  <div className="text-emerald-400">{usageSummary.inferredDensity}</div>
                </div>
              )}
              <div className="col-span-2">
                <div className="text-zinc-500 mb-1">Entity affinities</div>
                {Object.entries(usageSummary.entityAffinities).map(([entity, score]) => (
                  <div key={entity} className="flex items-center gap-2">
                    <div className="w-20 text-zinc-300">{entity}</div>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.round(score * 100)}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-zinc-500">
                      {Math.round(score * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Intent history */}
      {profile && profile.history.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400">
          <div className="uppercase tracking-wider text-zinc-500 mb-2">
            What Fluid remembers about you ({profile.history.length})
          </div>
          <ol className="space-y-1 list-decimal list-inside marker:text-zinc-600">
            {profile.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="truncate">
                <span className="text-zinc-300">{h.intent}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
