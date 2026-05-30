"use client";

import { useCallback, useEffect } from "react";

export interface UseMutationsOptions {
  /** POST endpoint that accepts `{ mutation: string, args: Record<string, unknown> }`. */
  endpoint: string;
  /**
   * Called after a successful mutation.
   * Use this to trigger data re-fetching or optimistic UI updates.
   */
  onSuccess?: (mutation: string, args: Record<string, unknown>) => void;
  onError?: (mutation: string, error: Error) => void;
}

/**
 * Wires up click handling for action buttons rendered by FluidView.
 *
 * Action buttons carry everything they need in data-* attributes:
 *   data-fluid-mutation — the mutation name (must match schema.mutations key)
 *   data-fluid-args     — JSON-serialised resolved arg map
 *   data-fluid-confirm  — optional confirmation prompt text
 *
 * This hook attaches a single delegated click listener on `document`. When a
 * [data-fluid-mutation] element is clicked:
 *   1. Optionally shows a confirm dialog.
 *   2. Disables the button and shows a spinner.
 *   3. POSTs to `endpoint`.
 *   4. On success, calls `onSuccess` and dispatches a "fluid:mutation-complete"
 *      CustomEvent (consumers can use this to trigger data refetch).
 *   5. On error, calls `onError` and restores the button.
 *
 * FluidView itself contains no event handlers — keeping it server-safe.
 */
export function useMutations(opts: UseMutationsOptions): void {
  const { endpoint, onSuccess, onError } = opts;

  const handleMutationClick = useCallback(
    async (btn: HTMLElement) => {
      const mutation = btn.getAttribute("data-fluid-mutation");
      if (!mutation) return;

      const rawArgs = btn.getAttribute("data-fluid-args") ?? "{}";
      const confirmText = btn.getAttribute("data-fluid-confirm");

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = {};
      }

      if (confirmText && !window.confirm(confirmText)) return;

      // Disable button during the request.
      const originalLabel = btn.textContent ?? "";
      btn.setAttribute("disabled", "true");
      btn.setAttribute("aria-busy", "true");
      btn.textContent = "…";

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mutation, args }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(`Mutation "${mutation}" failed (${res.status}): ${text}`);
        }

        onSuccess?.(mutation, args);

        // Notify any listener that wants to refetch data.
        window.dispatchEvent(
          new CustomEvent("fluid:mutation-complete", { detail: { mutation, args } }),
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(mutation, error);
        console.error("[fluid] mutation error:", error.message);
      } finally {
        btn.removeAttribute("disabled");
        btn.removeAttribute("aria-busy");
        btn.textContent = originalLabel;
      }
    },
    [endpoint, onSuccess, onError],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-fluid-mutation]");
      if (target instanceof HTMLElement) {
        void handleMutationClick(target);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [handleMutationClick]);
}
