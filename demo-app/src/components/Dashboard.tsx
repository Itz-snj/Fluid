"use client";

import { useState, useEffect } from "react";
import {
  FluidView,
  FluidChat,
  FluidProvider,
  useFluidIR,
  useFluidTelemetry,
  useMutations,
  type DataContext,
} from "@fluid/react";
import type { FluidIR } from "@fluid/core";

interface DashboardProps {
  data: DataContext;
  schema: any;
}

export function Dashboard({ data, schema }: DashboardProps) {
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  const [intent, setIntent] = useState<string>("Show tasks as a kanban board grouped by status");
  const [inputValue, setInputValue] = useState<string>(intent);
  const [learnMode, setLearnMode] = useState<boolean>(false);
  const [autoAdapt, setAutoAdapt] = useState<boolean>(true);
  const [currentSnapshotId, setCurrentSnapshotId] = useState<string | undefined>();
  const [role, setRole] = useState<string>("engineer");
  const [activeNav, setActiveNav] = useState<string>("Dashboard");

  // patchedIR overrides the generated IR when a chat patch is applied
  const [patchedIR, setPatchedIR] = useState<FluidIR | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("fluid_user_id");
    if (!id) {
      id = `user_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem("fluid_user_id", id);
    }
    setUserId(id);
    const name = localStorage.getItem("fluid_user_name") || "Demo User";
    setUserName(name);
    const savedLearn = localStorage.getItem("fluid_learn_mode");
    if (savedLearn === "true") setLearnMode(true);
    const savedAdapt = localStorage.getItem("fluid_auto_adapt");
    if (savedAdapt === "false") setAutoAdapt(false);
  }, []);

  const { ir: generatedIR, loading, error, refetch, profile } = useFluidIR({
    endpoint: "/api/generate",
    intent,
    userId: learnMode ? userId : undefined,
    learn: learnMode,
    role,
    device: "desktop",
    currentUserName: userName,
  }) || { ir: null, loading: false, error: null, refetch: () => {}, profile: null };

  // Clear patchedIR whenever we generate a new intent
  useEffect(() => { setPatchedIR(null); }, [intent]);

  // The IR to display: chat patches take priority over the generated IR
  const ir = patchedIR ?? generatedIR;

  useFluidTelemetry({
    userId,
    endpoint: "/api/telemetry",
    enabled: !!userId,
  });

  const mutationsResult = useMutations?.({ schema, endpoint: "/api/mutate" });
  const handleMutation = mutationsResult?.dispatch || (() => {});

  useEffect(() => {
    if (ir && (ir as any).snapshotId) {
      setCurrentSnapshotId((ir as any).snapshotId);
    }
  }, [ir]);

  const toggleLearnMode = () => {
    const next = !learnMode;
    setLearnMode(next);
    localStorage.setItem("fluid_learn_mode", String(next));
  };

  const toggleAutoAdapt = () => {
    const next = !autoAdapt;
    setAutoAdapt(next);
    localStorage.setItem("fluid_auto_adapt", String(next));
  };

  const handleGenerate = () => {
    setPatchedIR(null);
    if (inputValue === intent) {
      // Same intent — force a fresh generation bypassing the server cache
      refetch({ bypassCache: true });
    } else {
      // New intent — updating state triggers auto-refetch in useFluidIR
      setIntent(inputValue);
    }
  };

  const handleIRChange = (newIR: FluidIR, snapshotId: string, _version: number) => {
    setPatchedIR(newIR);
    setCurrentSnapshotId(snapshotId);
  };

  const navItems = [
    { icon: "⬡", label: "Dashboard" },
    { icon: "⊟", label: "Tasks" },
    { icon: "◎", label: "Projects" },
    { icon: "⊕", label: "Teams" },
    { icon: "⊘", label: "Analytics" },
    { icon: "⊛", label: "Settings" },
  ];

  const quickIntents = [
    { icon: "⊞", label: "Kanban Board", prompt: "Show tasks as a kanban board grouped by status" },
    { icon: "≡", label: "Task List", prompt: "List overdue tasks with priority badges" },
    { icon: "◫", label: "Dashboard", prompt: "Show me a dashboard with project stats" },
    { icon: "◳", label: "Team View", prompt: "Show tasks grouped by assignee" },
    { icon: "◷", label: "Timeline", prompt: "Show tasks sorted by due date" },
    { icon: "◈", label: "Focus Mode", prompt: "Show only high priority in-progress tasks" },
  ];

  const dashboard = (
    <div className="fluid-root">
      {/* Sidebar */}
      <aside className="fluid-sidebar">
        <div className="fluid-logo">
          <div className="fluid-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="fluid-logo-name">FluidCRM</p>
            <p className="fluid-logo-sub">Enterprise</p>
          </div>
        </div>

        <nav className="fluid-nav">
          {navItems.map(({ icon, label }) => (
            <button
              key={label}
              onClick={() => setActiveNav(label)}
              className={`fluid-nav-item ${activeNav === label ? "active" : ""}`}
            >
              <span className="fluid-nav-icon">{icon}</span>
              <span>{label}</span>
              {activeNav === label && <span className="fluid-nav-dot" />}
            </button>
          ))}
        </nav>

        {/* Auto-adapt toggle in sidebar */}
        <div className="fluid-adapt-panel">
          <div className="fluid-adapt-header">
            <span className="fluid-adapt-icon">✦</span>
            <span className="fluid-adapt-title">AI Auto-Adapt</span>
          </div>
          <p className="fluid-adapt-desc">Automatically apply intent changes based on your usage</p>
          <label className="fluid-toggle-row">
            <div className="toggle">
              <input type="checkbox" checked={autoAdapt} onChange={toggleAutoAdapt} />
              <span className="toggle-slider" />
            </div>
            <span className={`fluid-toggle-label ${autoAdapt ? "active" : ""}`}>
              {autoAdapt ? "Enabled" : "Disabled"}
            </span>
          </label>
          <label className="fluid-toggle-row" style={{ marginTop: "8px" }}>
            <div className="toggle">
              <input type="checkbox" checked={learnMode} onChange={toggleLearnMode} />
              <span className="toggle-slider" />
            </div>
            <span className={`fluid-toggle-label ${learnMode ? "active" : ""}`}>
              Remember preferences
              {learnMode && profile && profile.history.length > 0 && (
                <span className="fluid-history-badge">{profile.history.length}</span>
              )}
            </span>
          </label>
        </div>

        <div className="fluid-user">
          <div className="fluid-avatar">{userName.charAt(0).toUpperCase()}</div>
          <div className="fluid-user-info">
            <p className="fluid-user-name">{userName}</p>
            <p className="fluid-user-id">{userId.slice(0, 14)}…</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="fluid-main">
        {/* Header */}
        <header className="fluid-header">
          <div className="fluid-intent-row">
            <div className="fluid-intent-wrap">
              <span className="fluid-intent-spark">✦</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="Describe how you want to see your data…"
                className="fluid-intent-input"
              />
            </div>

            <div className="fluid-header-actions">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="fluid-role-select"
              >
                <option value="engineer">👨‍💻 Engineer</option>
                <option value="designer">👨‍🎨 Designer</option>
                <option value="pm">👩‍💼 PM</option>
                <option value="manager">👔 Manager</option>
              </select>

              <button
                onClick={handleGenerate}
                disabled={loading || !inputValue.trim()}
                className="fluid-generate-btn"
              >
                {loading ? (
                  <span className="fluid-generating">
                    <span className="fluid-spinner" />
                    Generating…
                  </span>
                ) : (
                  <>
                    <span>Generate</span>
                    <span className="fluid-btn-arrow">→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          {ir && !loading && (
            <div className="fluid-stats-bar">
              <span className={`fluid-stat-dot ${(ir as any).cached ? "cached" : "fresh"}`} />
              <span className="fluid-stat-text">{(ir as any).cached ? "Cached" : "Fresh"}</span>
              <span className="fluid-stat-sep">·</span>
              <span className="fluid-stat-text">{(ir as any).latencyMs || 0}ms</span>
              <span className="fluid-stat-sep">·</span>
              <span className="fluid-stat-text">{(ir as any).usage?.inputTokens || 0} tokens</span>
              {autoAdapt && (
                <>
                  <span className="fluid-stat-sep">·</span>
                  <span className="fluid-adapt-badge">✦ Auto-Adapt ON</span>
                </>
              )}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="fluid-content">
          {/* Loading shimmer */}
          {loading && !ir && (
            <div className="fluid-loading">
              <div className="fluid-loading-icon">
                <span className="fluid-spinner large" />
              </div>
              <p className="fluid-loading-title">Generating your personalized UI</p>
              <p className="fluid-loading-sub">Usually takes 5–15s on first generation</p>
              <div className="fluid-shimmer-grid">
                <div className="fluid-shimmer" style={{ height: 80 }} />
                <div className="fluid-shimmer" style={{ height: 80 }} />
                <div className="fluid-shimmer" style={{ height: 80 }} />
                <div className="fluid-shimmer" style={{ height: 200, gridColumn: "span 3" }} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="fluid-error-card">
              <div className="fluid-error-dot" />
              <div>
                <p className="fluid-error-title">Generation failed</p>
                <p className="fluid-error-detail">{typeof error === "string" ? error : "An error occurred"}</p>
                <button onClick={refetch} className="fluid-retry-btn">Try Again</button>
              </div>
            </div>
          )}

          {/* IR view */}
          {ir && !error && (
            <div className="fluid-view-wrap animate-fade-in">
              <FluidView
                ir={ir}
                data={data}
                schema={schema}
                onMutate={handleMutation}
              />
            </div>
          )}

          {/* Welcome state */}
          {!ir && !loading && !error && (
            <div className="fluid-welcome">
              <div className="fluid-welcome-hero">
                <div className="fluid-welcome-glow" />
                <div className="fluid-welcome-icon">✦</div>
                <h2 className="fluid-welcome-title">Welcome to FluidCRM</h2>
                <p className="fluid-welcome-sub">
                  Describe your workflow in natural language. Fluid generates a personalized interface instantly.
                </p>
              </div>

              <p className="fluid-quick-label">Quick starts</p>
              <div className="fluid-quick-grid">
                {quickIntents.map(({ icon, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => { setInputValue(prompt); setIntent(prompt); }}
                    className="fluid-quick-card"
                  >
                    <span className="fluid-quick-icon">{icon}</span>
                    <span className="fluid-quick-label-text">{label}</span>
                    <span className="fluid-quick-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Chat — always bottom right, manages its own open state */}
      {userId && <FluidChat />}
    </div>
  );

  if (!userId) return dashboard;

  return (
    <FluidProvider
      userId={userId}
      schemaName="demo"
      ir={ir ?? null}
      onIRChange={(newIR, snapshotId) => {
        handleIRChange(newIR as FluidIR, snapshotId ?? "", 0);
      }}
      currentSnapshotId={currentSnapshotId}
    >
      {dashboard}
    </FluidProvider>
  );
}
