"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FluidIR } from "@fluid/core";

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
  userId: string;
  schemaName: string;
  currentSnapshotId?: string;
  onIRChange: (newIR: FluidIR, snapshotId: string, version: number) => void;
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

export function useFluidChat(opts: UseFluidChatOptions): UseFluidChatReturn {
  const { userId, schemaName, currentSnapshotId, onIRChange } = opts;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isPatching, setIsPatching] = useState(false);
  const [irHistory, setIrHistory] = useState<SnapshotMeta[]>([]);
  const onIRChangeRef = useRef(onIRChange);
  onIRChangeRef.current = onIRChange;

  // Load chat history on mount.
  const loadHistory = useCallback(async () => {
    if (!userId || userId === "anon") return;
    try {
      const [chatRes, histRes] = await Promise.all([
        fetch(`/api/chat?userId=${encodeURIComponent(userId)}&schemaName=${schemaName}`),
        fetch(`/api/ir/history?userId=${encodeURIComponent(userId)}&schemaName=${schemaName}`),
      ]);
      if (chatRes.ok) {
        const data = await chatRes.json();
        setMessages(data.messages ?? []);
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setIrHistory(data.snapshots ?? []);
      }
    } catch {
      /* swallow */
    }
  }, [userId, schemaName]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Poll for suggestions every 30 seconds.
  useEffect(() => {
    if (!userId || userId === "anon") return;

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/suggestions?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions ?? []);
        }
      } catch {
        /* swallow */
      }
    };

    void fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 30_000);
    return () => clearInterval(interval);
  }, [userId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isPatching) return;

      // Optimistic append.
      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsPatching(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            currentSnapshotId,
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
          onIRChangeRef.current(data.newIR, data.newSnapshotId, data.newVersion);
          // Refresh history after a successful patch.
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
    [isPatching, currentSnapshotId, userId, schemaName, loadHistory],
  );

  const revert = useCallback(
    async (targetSnapshotId: string) => {
      setIsPatching(true);
      try {
        const res = await fetch("/api/chat/revert", {
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
          onIRChangeRef.current(data.newIR, data.newSnapshotId, data.newVersion);
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
    [userId, schemaName, loadHistory],
  );

  const acceptSuggestion = useCallback(
    async (id: string) => {
      setIsPatching(true);
      try {
        const res = await fetch("/api/suggestions/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId: id, action: "accept", userId }),
        });
        const data = await res.json();

        if (data.ok && data.newIR && data.newSnapshotId) {
          setSuggestions((prev) => prev.filter((s) => s.id !== id));
          onIRChangeRef.current(data.newIR, data.newSnapshotId, data.newVersion);
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
    [userId, loadHistory],
  );

  const dismissSuggestion = useCallback(
    async (id: string) => {
      try {
        await fetch("/api/suggestions/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId: id, action: "dismiss", userId }),
        });
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      } catch {
        /* swallow */
      }
    },
    [userId],
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
