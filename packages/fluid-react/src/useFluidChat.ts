"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FluidIR } from "@fluid-genui/core";
import {
  type FluidEndpoints,
  resolveEndpoints,
  useFluidContext,
} from "./FluidProvider";

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant" | "suggestion";
  content: string;
  snapshotId?: string | null;
  wasApplied?: boolean;
  createdAt?: string;
}

export interface SuggestionItem {
  id: string;
  type: string;
  message: string;
  proposedIntent: string;
}

export interface SnapshotMeta {
  id: string;
  version: number;
  source: string;
  changeDesc: string | null;
  createdAt: string;
}

export interface UseFluidChatOptions {
  /** Optional when a FluidProvider is mounted. */
  userId?: string;
  /** Optional when a FluidProvider is mounted. */
  schemaName?: string;
  currentSnapshotId?: string;
  /** The IR currently displayed — sent to the server so it knows what to patch. */
  currentIR?: FluidIR;
  /** Called when a patch/revert lands. Falls back to provider's setIR. */
  onIRChange?: (newIR: FluidIR, snapshotId: string, version: number) => void;
  /** Per-call endpoint overrides. Falls back to provider, then to "/api/*". */
  endpoints?: FluidEndpoints;
  /** Suggestion polling interval. Default 30 000 ms. Set 0 to disable. */
  suggestionPollMs?: number;
}

export interface UseFluidChatReturn {
  messages: ChatMessage[];
  suggestions: SuggestionItem[];
  isPatching: boolean;
  irHistory: SnapshotMeta[];
  sendMessage: (text: string) => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  revert: (snapshotId: string) => Promise<void>;
  loadHistory: () => Promise<void>;
}

export function useFluidChat(opts: UseFluidChatOptions = {}): UseFluidChatReturn {
  const ctx = useFluidContext();

  const userId = opts.userId ?? ctx?.userId ?? "";
  const schemaName = opts.schemaName ?? ctx?.schemaName ?? "";
  const currentSnapshotId = opts.currentSnapshotId ?? ctx?.currentSnapshotId;
  const currentIR = opts.currentIR ?? ctx?.ir ?? undefined;
  const suggestionPollMs = opts.suggestionPollMs ?? 30_000;
  const endpoints = resolveEndpoints(opts.endpoints, ctx?.endpoints);

  if (process.env.NODE_ENV !== "production" && !userId) {
    // eslint-disable-next-line no-console
    console.warn(
      "[fluid] useFluidChat called without userId and no FluidProvider in tree — chat features will be disabled.",
    );
  }

  const currentIRRef = useRef(currentIR);
  currentIRRef.current = currentIR;

  const onIRChangeRef = useRef<UseFluidChatOptions["onIRChange"]>(opts.onIRChange);
  onIRChangeRef.current = opts.onIRChange;

  const ctxSetIRRef = useRef(ctx?.setIR);
  ctxSetIRRef.current = ctx?.setIR;

  const applyIR = useCallback(
    (newIR: FluidIR, snapshotId: string, version: number) => {
      if (onIRChangeRef.current) {
        onIRChangeRef.current(newIR, snapshotId, version);
      } else if (ctxSetIRRef.current) {
        ctxSetIRRef.current(newIR, snapshotId, version);
      } else if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          "[fluid] useFluidChat produced a new IR but no onIRChange handler or FluidProvider is wired — the change is lost.",
        );
      }
    },
    [],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isPatching, setIsPatching] = useState(false);
  const [irHistory, setIrHistory] = useState<SnapshotMeta[]>([]);

  const loadHistory = useCallback(async () => {
    if (!userId || userId === "anon") return;
    try {
      const [chatRes, histRes] = await Promise.all([
        fetch(
          `${endpoints.chat}?userId=${encodeURIComponent(userId)}&schemaName=${encodeURIComponent(schemaName)}`,
        ),
        fetch(
          `${endpoints.irHistory}?userId=${encodeURIComponent(userId)}&schemaName=${encodeURIComponent(schemaName)}`,
        ),
      ]);
      if (chatRes.ok) {
        const data = await chatRes.json();
        setMessages(data.messages ?? []);
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setIrHistory(data.snapshots ?? data.history ?? []);
      }
    } catch {
      /* swallow */
    }
  }, [userId, schemaName, endpoints.chat, endpoints.irHistory]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!userId || userId === "anon" || suggestionPollMs <= 0) return;

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(
          `${endpoints.suggestions}?userId=${encodeURIComponent(userId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions ?? []);
        }
      } catch {
        /* swallow */
      }
    };

    void fetchSuggestions();
    const interval = setInterval(fetchSuggestions, suggestionPollMs);
    return () => clearInterval(interval);
  }, [userId, endpoints.suggestions, suggestionPollMs]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isPatching) return;

      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsPatching(true);

      try {
        const res = await fetch(endpoints.chat, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            currentSnapshotId,
            currentIR: currentIRRef.current,
            userId,
            schemaName,
          }),
        });
        const data = await res.json();

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.reply ?? data.error ?? "Something went wrong.",
          snapshotId: data.newSnapshotId ?? null,
          wasApplied: data.canApply ?? false,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (data.canApply && data.newIR && data.newSnapshotId) {
          applyIR(data.newIR, data.newSnapshotId, data.newVersion);
          void loadHistory();
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Network error"}`,
          },
        ]);
      } finally {
        setIsPatching(false);
      }
    },
    [
      isPatching,
      currentSnapshotId,
      userId,
      schemaName,
      loadHistory,
      endpoints.chat,
      applyIR,
    ],
  );

  const revert = useCallback(
    async (targetSnapshotId: string) => {
      setIsPatching(true);
      try {
        const res = await fetch(endpoints.chatRevert, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, targetSnapshotId, schemaName }),
        });
        const data = await res.json();

        if (data.newIR && data.newSnapshotId) {
          const revertMsg: ChatMessage = {
            role: "assistant",
            content: `Reverted to v${data.newVersion - 1 || "previous"}.`,
            snapshotId: data.newSnapshotId,
            wasApplied: true,
          };
          setMessages((prev) => [...prev, revertMsg]);
          applyIR(data.newIR, data.newSnapshotId, data.newVersion);
          void loadHistory();
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Revert failed: ${err instanceof Error ? err.message : "Network error"}`,
          },
        ]);
      } finally {
        setIsPatching(false);
      }
    },
    [userId, schemaName, loadHistory, endpoints.chatRevert, applyIR],
  );

  const acceptSuggestion = useCallback(
    async (id: string) => {
      setIsPatching(true);
      try {
        const res = await fetch(endpoints.suggestionsResolve, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId: id, action: "accept", userId }),
        });
        const data = await res.json();

        if (data.ok && data.newIR && data.newSnapshotId) {
          setSuggestions((prev) => prev.filter((s) => s.id !== id));
          applyIR(data.newIR, data.newSnapshotId, data.newVersion);
          void loadHistory();
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.error ?? "Failed to apply suggestion." },
          ]);
        }
      } catch {
        /* swallow */
      } finally {
        setIsPatching(false);
      }
    },
    [userId, loadHistory, endpoints.suggestionsResolve, applyIR],
  );

  const dismissSuggestion = useCallback(
    async (id: string) => {
      try {
        await fetch(endpoints.suggestionsResolve, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId: id, action: "dismiss", userId }),
        });
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      } catch {
        /* swallow */
      }
    },
    [userId, endpoints.suggestionsResolve],
  );

  return {
    messages,
    suggestions,
    isPatching,
    irHistory,
    sendMessage,
    acceptSuggestion,
    dismissSuggestion,
    revert,
    loadHistory,
  };
}
