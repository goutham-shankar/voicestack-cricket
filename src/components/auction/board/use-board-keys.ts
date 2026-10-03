"use client";

import { useEffect } from "react";

/**
 * The board's keyboard shortcuts: 1-9 bid for that team, S sell, U unsold,
 * Z undo the last bid, N bring up the next player, + and - change the next bid.
 * Ignored while the operator is typing in a field.
 */
export function useBoardKeys(handlers: {
  onBidTeam?: (index: number) => void;
  onSell?: () => void;
  onUnsold?: () => void;
  onUndo?: () => void;
  onNext?: () => void;
  onNudge?: (direction: 1 | -1) => void;
  enabled?: boolean;
}) {
  const { enabled = true } = handlers;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (event.key >= "1" && event.key <= "9") {
        handlers.onBidTeam?.(Number(event.key) - 1);
        event.preventDefault();
        return;
      }

      switch (event.key.toLowerCase()) {
        case "s":
          handlers.onSell?.();
          event.preventDefault();
          break;
        case "u":
          handlers.onUnsold?.();
          event.preventDefault();
          break;
        case "z":
          handlers.onUndo?.();
          event.preventDefault();
          break;
        case "n":
          handlers.onNext?.();
          event.preventDefault();
          break;
        case "+":
        case "=":
          handlers.onNudge?.(1);
          event.preventDefault();
          break;
        case "-":
        case "_":
          handlers.onNudge?.(-1);
          event.preventDefault();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // handlers is recreated each render; the listener reads it through closure.
  });
}
