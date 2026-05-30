"use client";

import { useState, useRef, useEffect } from "react";
import type { FluidIR } from "@fluid/core";
import {
  useFluidChat,
  type ChatMessage,
  type SuggestionItem,
  type SnapshotMeta,
} from "./useFluidChat";

export interface FluidChatProps {
  userId: string;
  schemaName?: string;
  currentSnapshotId?: string;
  onIRChange: (newIR: FluidIR, snapshotId: string, version: number) => void;
}

export function FluidChat({
  userId,
  schemaName = "tasks",
  currentSnapshotId,
  onIRChange,
}: FluidChatProps) {
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
    onIRChange,
  });

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suggestions, isPatching]);

  const handleSend = async () => {
    if (!input.trim() || isPatching) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
        title="Open Fluid Chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {suggestions.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400 text-xs text-black flex items-center justify-center font-bold">
            {suggestions.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[70vh] rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col overflow-hidden" style={{ backdropFilter: "blur(20px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-zinc-100">Fluid Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition"
            title="Version history"
          >
            {showHistory ? "Chat" : `History`}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-200 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[50vh]">
        {showHistory ? (
          <HistoryPanel history={irHistory} onRevert={revert} isPatching={isPatching} />
        ) : (
          <>
            {/* Welcome message if empty */}
            {messages.length === 0 && suggestions.length === 0 && (
              <div className="text-xs text-zinc-500 italic py-4 text-center">
                Tell me how to customize this layout. For example: &quot;Move the task section to the top&quot; or &quot;Show tasks as a kanban board&quot;.
              </div>
            )}

            {/* Suggestion cards */}
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => void acceptSuggestion(s.id)}
                onDismiss={() => void dismissSuggestion(s.id)}
                disabled={isPatching}
              />
            ))}

            {/* Chat messages */}
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id ?? `${msg.role}-${i}`}
                message={msg}
                onRevert={msg.snapshotId ? () => void revert(msg.snapshotId!) : undefined}
                isPatching={isPatching}
              />
            ))}

            {/* Patching indicator */}
            {isPatching && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Applying changes…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      {!showHistory && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a layout change…"
            disabled={isPatching}
            className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPatching || !input.trim()}
            className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 transition"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function MessageBubble({
  message,
  onRevert,
  isPatching,
}: {
  message: ChatMessage;
  onRevert?: () => void;
  isPatching: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.wasApplied && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            disabled={isPatching}
            className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50"
          >
            ↩ Revert this change
          </button>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  disabled,
}: {
  suggestion: SuggestionItem;
  onAccept: () => void;
  onDismiss: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="text-amber-400 text-base mt-0.5">💡</span>
        <div className="flex-1">
          <p className="text-zinc-200">{suggestion.message}</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onAccept}
              disabled={disabled}
              className="text-xs rounded-md bg-emerald-600 text-white px-3 py-1 hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={disabled}
              className="text-xs rounded-md bg-zinc-700 text-zinc-300 px-3 py-1 hover:bg-zinc-600 disabled:opacity-50 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  onRevert,
  isPatching,
}: {
  history: SnapshotMeta[];
  onRevert: (snapshotId: string) => void;
  isPatching: boolean;
}) {
  if (history.length === 0) {
    return (
      <div className="text-xs text-zinc-500 italic py-4 text-center">
        No version history yet. Generate a UI to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
        Version History
      </div>
      {history.map((s, i) => (
        <div
          key={s.id}
          className={`rounded-lg border p-3 text-xs ${
            i === 0
              ? "border-blue-700 bg-blue-950/20"
              : "border-zinc-800 bg-zinc-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-zinc-300">v{s.version}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                  s.source === "generate"
                    ? "bg-emerald-900 text-emerald-300"
                    : s.source === "patch"
                      ? "bg-blue-900 text-blue-300"
                      : s.source === "revert"
                        ? "bg-amber-900 text-amber-300"
                        : "bg-violet-900 text-violet-300"
                }`}
              >
                {s.source}
              </span>
            </div>
            {i > 0 && (
              <button
                type="button"
                onClick={() => onRevert(s.id)}
                disabled={isPatching}
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50"
              >
                Revert
              </button>
            )}
            {i === 0 && (
              <span className="text-emerald-400">current</span>
            )}
          </div>
          {s.changeDesc && (
            <p className="text-zinc-400 mt-1 truncate">{s.changeDesc}</p>
          )}
          <p className="text-zinc-600 mt-0.5">
            {new Date(s.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
