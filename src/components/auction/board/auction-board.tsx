"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmt } from "@/lib/auction-engine";
import { useAuctionState } from "@/lib/use-auction-state";
import type { FullAuctionState } from "@/lib/auction-types";
import { boardFontClass } from "@/components/auction/board/fonts";
import { LotBoard } from "@/components/auction/board/lot-board";
import { PlayerQueue } from "@/components/auction/board/player-queue";
import { PurseTable } from "@/components/auction/board/purse-table";
import { useBoardKeys } from "@/components/auction/board/use-board-keys";
import "@/components/auction/board/board.css";

async function post(url: string, body?: unknown): Promise<FullAuctionState> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Something went wrong"
    );
  }
  return data as FullAuctionState;
}

export function AuctionBoard() {
  const { state, connected, apply } = useAuctionState();
  const [busy, setBusy] = useState(false);

  const minNext = state?.minNextBid ?? null;
  const lotId = state?.auctionState.currentPlayerId?._id ?? null;
  const bidCount = state?.auctionState.bids.length ?? 0;

  /**
   * The pending amount follows the engine's minimum until the operator types or
   * nudges it. Tagging that override with the lot and the bid count lets it
   * expire on its own as soon as either moves, so nothing has to reset it.
   */
  const lotSignature = `${lotId ?? "none"}:${bidCount}`;
  const [override, setOverride] = useState<{
    signature: string;
    value: number;
  } | null>(null);
  const nextBid = override?.signature === lotSignature ? override.value : null;
  const setNextBid = useCallback(
    (value: number) => setOverride({ signature: lotSignature, value }),
    [lotSignature]
  );

  const run = useCallback(
    async (action: () => Promise<FullAuctionState>) => {
      setBusy(true);
      try {
        apply(await action());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [apply]
  );

  const effectiveNextBid = nextBid ?? minNext ?? 0;
  const isLive = state?.auctionState.status === "LIVE";

  useBoardKeys({
    enabled: Boolean(state) && isLive && !busy,
    onBidTeam: (index) => {
      const team = state?.teams[index];
      if (!team?.board?.limit?.ok) return;
      void run(() =>
        post("/api/auction/bid", { teamId: team._id, amount: effectiveNextBid })
      );
    },
    onSell: () => void run(() => post("/api/auction/sell")),
    onUnsold: () => void run(() => post("/api/auction/unsold")),
    onUndo: () => void run(() => post("/api/auction/bid/undo")),
    onNudge: (direction) => {
      if (minNext == null || !state) return;
      const step = state.settings.bidIncrement * direction;
      setNextBid(Math.max(minNext, effectiveNextBid + step));
    },
  });

  const warnings = useMemo(() => {
    if (!state) return [];
    const issues: string[] = [];

    for (const team of state.teams) {
      if (team.board && team.board.shortfall > 0) {
        issues.push(
          `${team.name} is ₹${fmt(
            team.board.shortfall
          )} short of filling its squad at base prices.`
        );
      }
    }

    const live = state.auctionState.currentPlayerId;
    for (const category of state.categories) {
      const needed = state.teams.reduce(
        (total, team) => total + (team.board?.rem?.[category._id] ?? 0),
        0
      );
      let available = state.pendingPlayers.filter(
        (player) => player.categoryId?._id === category._id
      ).length;
      if (live?.categoryId?._id === category._id) available += 1;

      if (needed > available) {
        issues.push(
          `Teams still need ${needed} ${category.name} but only ${available} ${
            available === 1 ? "is" : "are"
          } left to auction.`
        );
      }
    }

    return issues;
  }, [state]);

  if (!state) {
    return (
      <p className="text-sm text-muted-foreground">Loading the auction board…</p>
    );
  }

  const auctionState = state.auctionState;
  const openRounds = new Set(auctionState.openCategoryIds);

  const bid = (teamId: string) =>
    run(() => post("/api/auction/bid", { teamId, amount: effectiveNextBid }));

  return (
    <div className={`vpl-board ${boardFontClass}`}>
      {!connected && (
        <p className="banner" role="status">
          Reconnecting to the live auction… the board will catch up on its own.
        </p>
      )}

      {state.categories.length === 0 ? (
        <p className="banner">
          No player categories yet. Add them in Configuration to set up the
          auction rounds and the bid limits.
        </p>
      ) : (
        <nav className="rounds" aria-label="Auction rounds">
          {state.categories.map((category, index) => {
            const open = openRounds.has(category._id);
            const current = auctionState.currentCategoryId === category._id;
            const waiting = state.pendingPlayers.filter(
              (player) =>
                player.status === "PENDING" &&
                player.categoryId?._id === category._id
            ).length;

            return (
              <button
                key={category._id}
                type="button"
                className="round"
                aria-current={current ? "step" : undefined}
                disabled={busy || isLive}
                onClick={() =>
                  run(() => post("/api/auction/round", { categoryId: category._id }))
                }
              >
                <span className="num" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="rt">{category.name} round</span>
                <span className="rs">
                  {open
                    ? `₹${fmt(category.defaultBasePrice)} released, ${waiting} waiting`
                    : `Releases ₹${fmt(category.defaultBasePrice)} per team`}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {warnings.length > 0 && (
        <div className="warn" role="note">
          {warnings.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      )}

      <div className="stage">
        <section className="board" aria-label="Current player">
          <LotBoard
            state={state}
            nextBid={effectiveNextBid}
            onNextBidChange={setNextBid}
            busy={busy}
            onBid={bid}
            onSell={() => run(() => post("/api/auction/sell"))}
            onUnsold={() => run(() => post("/api/auction/unsold"))}
            onUndo={() => run(() => post("/api/auction/bid/undo"))}
            onBringUp={(playerId) =>
              run(() => post("/api/auction/start", { playerId }))
            }
          />
        </section>

        <aside className="panel" aria-label="Player queue">
          <PlayerQueue
            state={state}
            busy={busy}
            onBringUp={(playerId) =>
              run(() => post("/api/auction/start", { playerId }))
            }
            onRequeue={(playerId) =>
              run(() => post("/api/auction/requeue", { playerId }))
            }
          />
        </aside>
      </div>

      <h2 className="section-title">Team purses</h2>
      <PurseTable state={state} />

      <details className="howto">
        <summary>How the bid limit works</summary>
        <p>
          A team can never bid so much that it can&apos;t fill the rest of its
          squad at base price. Its max bid is the money it has left, minus the
          base price of every other slot it still has to fill.
        </p>
        <p>
          Money for a round that hasn&apos;t opened yet stays locked, so it
          can&apos;t be spent in an earlier round. Opening a round releases that
          money, and teams can then bid above the base price with whatever they
          have saved.
        </p>
        <p>
          A team that already has its minimum in a category can buy extras only
          while enough players are left for every other team to reach its own
          minimum.
        </p>
        <p>Open a team in the table above to see its calculation.</p>
      </details>
    </div>
  );
}
