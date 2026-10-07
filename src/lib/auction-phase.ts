import { fmt } from "@/lib/auction-engine";
import { useEffect, useState } from "react";
import type { AuctionStateDTO, AuctionResult } from "@/lib/auction-types";

/** Broadcast phases. Derived from real auction state — never set by hand. */
export type AuctionPhase =
  | "WAITING"
  | "INTRO"
  | "BIDDING"
  | "SOLD"
  | "UNSOLD";

/** How long a freshly-loaded lot stays on the intro composition. */
const INTRO_MS = 5000;

/**
 * Resolves the phase from live auction state. A lot stays in BIDDING until the
 * auctioneer marks it sold or unsold — there is no clock to advance it.
 */
export function useAuctionPhase(
  auctionState: AuctionStateDTO,
  flash: AuctionResult | null
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
  SOLD: { label: "Sold", tone: "sold" },
  UNSOLD: { label: "Unsold", tone: "unsold" },
};

/**
 * Kept as a name the display components already import; the formatting itself
 * lives in auction-engine's `fmt`, so there is one money format in the app.
 */
export function compactMoney(n: number): string {
  return fmt(n);
}
