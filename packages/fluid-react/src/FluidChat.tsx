"use client";

import { useState, useRef, useEffect } from "react";
import type { FluidIR } from "@fluid-genui/core";
import {
  useFluidChat,
  type ChatMessage,
  type SuggestionItem,
  type SnapshotMeta,
} from "./useFluidChat";
import { type FluidEndpoints, useFluidContext } from "./FluidProvider";

export interface FluidChatProps {
  /** Optional when a FluidProvider is mounted. */
  userId?: string;
  /** Optional when a FluidProvider is mounted. Default "tasks" only if neither is set. */
  schemaName?: string;
  currentSnapshotId?: string;
  currentIR?: FluidIR;
  /** Required when not using FluidProvider; otherwise falls back to provider's setIR. */
  onIRChange?: (newIR: FluidIR, snapshotId: string, version: number) => void;
  /** Per-component endpoint overrides; falls back to provider then "/api/*". */
  endpoints?: FluidEndpoints;
}

const S = {
  bg: "rgba(8,11,20,0.92)",
  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(99,102,241,0.4)",
  text1: "rgba(255,255,255,0.92)",
  text2: "rgba(255,255,255,0.55)",
  text3: "rgba(255,255,255,0.3)",
  accent: "#6366f1",
  accent2: "#8b5cf6",
  radius: "16px",
  radiusSm: "10px",
};

export function FluidChat(props: FluidChatProps = {}) {
  const ctx = useFluidContext();
  const userId = props.userId ?? ctx?.userId ?? "";
  const schemaName = props.schemaName ?? ctx?.schemaName ?? "tasks";
  const currentSnapshotId = props.currentSnapshotId ?? ctx?.currentSnapshotId;
  const currentIR = props.currentIR ?? ctx?.ir ?? undefined;
  const onIRChange = props.onIRChange;
  const endpoints = props.endpoints;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    suggestions,
    isPatching,
    irHistory,
    sendMessage,
    acceptSuggestion,
    dismissSuggestion,
    revert,
  } = useFluidChat({
    userId,
    schemaName,
    currentSnapshotId,
    currentIR,
    onIRChange,
    endpoints,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suggestions, isPatching]);

  const handleSend = async () => {
    if (!input.trim() || isPatching) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  /* ── FAB (closed state) ─────────────────────────────────── */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open Fluid Chat"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          height: "52px",
          width: "52px",
          borderRadius: "16px",
          border: "none",
          background: `linear-gradient(135deg, ${S.accent}, ${S.accent2}, #a855f7)`,
          boxShadow: "0 8px 32px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.07)";
          e.currentTarget.style.boxShadow = "0 12px 40px rgba(99,102,241,0.5), 0 0 0 1px rgba(99,102,241,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.15)";
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {suggestions.length > 0 && (
          <span style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            height: "20px",
            minWidth: "20px",
            padding: "0 4px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #f59e0b, #f97316)",
            boxShadow: "0 2px 8px rgba(245,158,11,0.5)",
            fontSize: "10px",
            fontWeight: 700,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(8,11,20,0.9)",
          }}>
            {suggestions.length}
          </span>
        )}
      </button>
    );
  }

  /* ── Open panel ─────────────────────────────────────────── */
  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: 9999,
      width: "380px",
      maxHeight: "72vh",
      borderRadius: S.radius,
      background: S.bg,
      backdropFilter: "blur(28px) saturate(1.4)",
      WebkitBackdropFilter: "blur(28px) saturate(1.4)",
      border: `1px solid ${S.border}`,
      boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            height: "30px",
            width: "30px",
            borderRadius: "9px",
            background: `linear-gradient(135deg, ${S.accent}, #a855f7)`,
            boxShadow: "0 0 14px rgba(99,102,241,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: S.text1 }}>Fluid Assistant</div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
              <div style={{ height: "5px", width: "5px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 5px rgba(16,185,129,0.6)" }} />
              <span style={{ fontSize: "10px", color: S.text3 }}>Online</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            style={{
              fontSize: "11px",
              padding: "5px 10px",
              borderRadius: "8px",
              border: showHistory ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
              background: showHistory ? "rgba(139,92,246,0.12)" : "transparent",
              color: showHistory ? "#a78bfa" : S.text3,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.18s",
            }}
          >
            {showHistory ? "← Chat" : "History"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              fontSize: "14px",
              padding: "4px 8px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: S.text3,
              cursor: "pointer",
              transition: "all 0.18s",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = S.text1; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = S.text3; }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "14px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minHeight: "180px",
        maxHeight: "50vh",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.08) transparent",
      }}>
        {showHistory ? (
          <HistoryPanel history={irHistory} onRevert={revert} isPatching={isPatching} />
        ) : (
          <>
            {messages.length === 0 && suggestions.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <div style={{
                  display: "inline-flex",
                  height: "44px",
                  width: "44px",
                  borderRadius: "14px",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))",
                  border: "1px solid rgba(99,102,241,0.15)",
                  marginBottom: "12px",
                }}>
                  <span style={{ fontSize: "18px" }}>✨</span>
                </div>
                <p style={{ fontSize: "12px", color: S.text3, lineHeight: 1.7, maxWidth: "220px", margin: "0 auto" }}>
                  Tell me how to customize this layout. Try &quot;Add filters&quot; or &quot;Show deals first&quot;.
                </p>
              </div>
            )}

            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => void acceptSuggestion(s.id)}
                onDismiss={() => void dismissSuggestion(s.id)}
                disabled={isPatching}
              />
            ))}

            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id ?? `${msg.role}-${i}`}
                message={msg}
                onRevert={msg.snapshotId ? () => void revert(msg.snapshotId!) : undefined}
                isPatching={isPatching}
              />
            ))}

            {isPatching && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.12)",
                fontSize: "12px",
                color: S.text2,
              }}>
                <div style={{
                  height: "12px",
                  width: "12px",
                  borderRadius: "50%",
                  border: "2px solid rgba(99,102,241,0.3)",
                  borderTopColor: S.accent,
                  animation: "spin 0.7s linear infinite",
                  flexShrink: 0,
                }} />
                Applying changes…
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      {!showHistory && (
        <form
          onSubmit={(e) => { e.preventDefault(); void handleSend(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 14px",
            borderTop: `1px solid ${S.border}`,
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a layout change…"
            disabled={isPatching}
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: S.text1,
              fontSize: "12px",
              fontFamily: "inherit",
              outline: "none",
              transition: "border-color 0.18s, box-shadow 0.18s",
              opacity: isPatching ? 0.4 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <button
            type="submit"
            disabled={isPatching || !input.trim()}
            style={{
              padding: "9px 16px",
              borderRadius: "10px",
              border: "none",
              background: isPatching || !input.trim()
                ? "rgba(255,255,255,0.05)"
                : `linear-gradient(135deg, ${S.accent}, ${S.accent2})`,
              color: isPatching || !input.trim() ? S.text3 : "white",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: isPatching || !input.trim() ? "not-allowed" : "pointer",
              boxShadow: isPatching || !input.trim() ? "none" : "0 4px 14px rgba(99,102,241,0.3)",
              transition: "all 0.18s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </form>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── MessageBubble ──────────────────────────────────────────── */
function MessageBubble({ message, onRevert, isPatching }: { message: ChatMessage; onRevert?: () => void; isPatching: boolean }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%",
        padding: "9px 13px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        fontSize: "12px",
        lineHeight: 1.6,
        ...(isUser
          ? { background: `linear-gradient(135deg, ${S.accent}, #7c3aed)`, color: "white", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }
          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(226,232,240,0.9)" }),
      }}>
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{message.content}</p>
        {!isUser && message.wasApplied && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            disabled={isPatching}
            style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "rgba(129,140,248,0.8)",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "inherit",
              opacity: isPatching ? 0.4 : 1,
            }}
          >
            ↩ Revert this change
          </button>
        )}
      </div>
    </div>
  );
}

/* ── SuggestionCard ─────────────────────────────────────────── */
function SuggestionCard({ suggestion, onAccept, onDismiss, disabled }: { suggestion: SuggestionItem; onAccept: () => void; onDismiss: () => void; disabled: boolean }) {
  return (
    <div style={{ borderRadius: "12px", padding: "14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)", fontSize: "12px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ height: "28px", width: "28px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.15)", flexShrink: 0 }}>
          <span style={{ fontSize: "13px" }}>💡</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: "rgba(226,232,240,0.9)", lineHeight: 1.6, margin: "0 0 10px" }}>{suggestion.message}</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={onAccept} disabled={disabled} style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" }}>Apply</button>
            <button type="button" onClick={onDismiss} disabled={disabled} style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.8)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" }}>Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HistoryPanel ───────────────────────────────────────────── */
function HistoryPanel({ history, onRevert, isPatching }: { history: SnapshotMeta[]; onRevert: (id: string) => void; isPatching: boolean }) {
  if (history.length === 0) {
    return <div style={{ textAlign: "center", padding: "28px 0", fontSize: "12px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No version history yet.</div>;
  }
  const sourceStyle: Record<string, React.CSSProperties> = {
    generate: { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#6ee7b7" },
    patch:    { background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" },
    revert:   { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#fcd34d" },
    suggestion:{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "#c4b5fd" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, color: "rgba(255,255,255,0.28)", marginBottom: "4px" }}>Version History</div>
      {history.map((s, i) => (
        <div key={s.id} style={{ borderRadius: "10px", padding: "12px", fontSize: "12px", background: i === 0 ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)", border: i === 0 ? "1px solid rgba(99,102,241,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>v{s.version}</span>
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, ...(sourceStyle[s.source] ?? sourceStyle.generate) }}>{s.source}</span>
            </div>
            {i > 0 ? (
              <button type="button" onClick={() => onRevert(s.id)} disabled={isPatching} style={{ fontSize: "11px", color: "#818cf8", background: "transparent", border: "none", cursor: isPatching ? "not-allowed" : "pointer", textDecoration: "underline", opacity: isPatching ? 0.4 : 1, fontFamily: "inherit" }}>Revert</button>
            ) : (
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em" }}>current</span>
            )}
          </div>
          {s.changeDesc && <p style={{ color: "rgba(148,163,184,0.7)", marginTop: "6px", marginBottom: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.changeDesc}</p>}
          <p style={{ color: "rgba(255,255,255,0.2)", marginTop: "4px", marginBottom: 0, fontSize: "10px" }}>{new Date(s.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
