import { useEffect, useState } from "react";
import type { AuctionStateDTO, AuctionResult } from "@/lib/auction-types";

/** Broadcast phases. Derived from real auction state — never set by hand. */
export type AuctionPhase =
  | "WAITING"
  | "INTRO"
  | "BIDDING"
  | "GOING_ONCE"
  | "GOING_TWICE"
  | "SOLD"
  | "UNSOLD";

/** How long a freshly-loaded lot stays on the intro composition. */
const INTRO_MS = 5000;
/** Countdown thresholds, in seconds remaining, for the two warning calls. */
const GOING_ONCE_S = 10;
const GOING_TWICE_S = 5;

/**
 * Ticks once a second off `timerEndsAt` so the countdown stays smooth between
 * server pushes. Returns null when no timer is running.
 */
export function useCountdown(auctionState: AuctionStateDTO): number | null {
  const { timerEnabled, timerEndsAt, timerPaused, timerRemainingMs } = auctionState;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timerEnabled || timerPaused || !timerEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timerEnabled, timerPaused, timerEndsAt]);

  if (!timerEnabled) return null;
  // Paused clocks report the frozen remainder rather than counting down.
  if (timerPaused) {
    return timerRemainingMs != null ? Math.max(0, timerRemainingMs / 1000) : null;
  }
  if (!timerEndsAt) return null;
  return Math.max(0, (new Date(timerEndsAt).getTime() - now) / 1000);
}

/**
 * Resolves the phase from live auction state.
 *
 * GOING ONCE / GOING TWICE are read off the real countdown, so they only
 * appear when the auctioneer is actually running a timed lot. With the timer
 * disabled a lot stays in BIDDING until it is marked sold or unsold.
 */
export function useAuctionPhase(
  auctionState: AuctionStateDTO,
  flash: AuctionResult | null,
  secondsLeft: number | null
): AuctionPhase {
  const player = auctionState.currentPlayerId;
  const playerId = player?._id ?? null;

  // Intro is a plain flag rather than a deadline compared at render time, so
  // the phase stays a pure function of state. The lot change is applied during
  // render; only the timer that ends the window lives in an effect.
  const [intro, setIntro] = useState({ id: playerId, active: playerId != null });
  if (intro.id !== playerId) {
    setIntro({ id: playerId, active: playerId != null });
  }

  useEffect(() => {
    if (!intro.active) return;
    const t = window.setTimeout(
      () => setIntro((s) => (s.active ? { ...s, active: false } : s)),
      INTRO_MS
    );
    return () => window.clearTimeout(t);
  }, [intro.active, intro.id]);

  if (flash) return flash.status === "SOLD" ? "SOLD" : "UNSOLD";
  if (!player) return "WAITING";
  if (intro.active) return "INTRO";
  if (secondsLeft != null && !auctionState.timerPaused) {
    if (secondsLeft <= GOING_TWICE_S) return "GOING_TWICE";
    if (secondsLeft <= GOING_ONCE_S) return "GOING_ONCE";
  }
  return "BIDDING";
}

/** Label, colour token and urgency for each phase's on-screen badge. */
export const PHASE_META: Record<
  AuctionPhase,
  { label: string; tone: "live" | "gold" | "sold" | "unsold" | "muted"; urgent?: boolean }
> = {
  WAITING: { label: "Next Lot", tone: "muted" },
  INTRO: { label: "On The Block", tone: "live" },
  BIDDING: { label: "Bidding Open", tone: "live" },
  GOING_ONCE: { label: "Going Once", tone: "gold", urgent: true },
  GOING_TWICE: { label: "Going Twice", tone: "gold", urgent: true },
  SOLD: { label: "Sold", tone: "sold" },
  UNSOLD: { label: "Unsold", tone: "unsold" },
};

/** Compact Indian-format money for stat strips: ₹4.8Cr, ₹25L. */
export function compactMoney(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 === 0 ? 0 : 1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}
