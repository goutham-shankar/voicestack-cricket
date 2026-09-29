"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AuctionStateDTO } from "@/lib/auction-types";

function formatSeconds(totalMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AuctionTimer({
  auctionState,
  size = "md",
  className,
}: {
  auctionState: AuctionStateDTO;
  size?: "md" | "lg";
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (!auctionState.timerEnabled || auctionState.timerPaused) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [auctionState.timerEnabled, auctionState.timerPaused, auctionState.timerEndsAt]);

  const remainingMs = auctionState.timerPaused
    ? auctionState.timerRemainingMs ?? 0
    : auctionState.timerEndsAt
      ? new Date(auctionState.timerEndsAt).getTime() - now
      : 0;

  useEffect(() => {
    if (
      !auctionState.timerEnabled ||
      auctionState.timerPaused ||
      !auctionState.timerEndsAt ||
      remainingMs > 0 ||
      resolvingRef.current
    ) {
      return;
    }

    resolvingRef.current = true;
    fetch("/api/auction/resolve", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        resolvingRef.current = false;
      });
  }, [
    auctionState.timerEnabled,
    auctionState.timerPaused,
    auctionState.timerEndsAt,
    remainingMs,
  ]);

  if (!auctionState.timerEnabled) {
    return null;
  }

  const isLow = remainingMs <= 10_000 && remainingMs > 0;
  const large = size === "lg";

  return (
    <div
      className={cn(
        "rounded-2xl border text-center",
        large ? "min-w-40 px-6 py-4" : "px-4 py-2",
        isLow ? "animate-live-pulse border-live/60" : "border-border",
        className
      )}
    >
      <p
        className={cn(
          "uppercase tracking-wide text-muted-foreground",
          large ? "text-sm" : "text-xs"
        )}
      >
        {auctionState.timerPaused
          ? "Paused"
          : remainingMs <= 0
            ? "Closing…"
            : "Timer"}
      </p>
      <p
        className={cn(
          "font-mono font-bold tabular-nums",
          large ? "mt-1 text-5xl" : "text-2xl",
          isLow || remainingMs <= 0 ? "text-live" : "text-foreground"
        )}
      >
        {formatSeconds(remainingMs)}
      </p>
    </div>
  );
}
