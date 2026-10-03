"use client";

import { fmt } from "@/lib/auction-engine";
import type { FullAuctionState } from "@/lib/auction-types";
import { teamColor } from "@/components/auction/board/board-utils";
import { ResultStamp } from "@/components/auction/board/result-stamp";
import { TeamPaddles } from "@/components/auction/board/team-paddles";

/** The green board: the lot on the block, the standing bid, and the paddles. */
export function LotBoard({
  state,
  nextBid,
  onNextBidChange,
  busy,
  onBid,
  onSell,
  onUnsold,
  onUndo,
  onBringUp,
}: {
  state: FullAuctionState;
  nextBid: number;
  onNextBidChange: (value: number) => void;
  busy: boolean;
  onBid: (teamId: string) => void;
  onSell: () => void;
  onUnsold: () => void;
  onUndo: () => void;
  onBringUp: (playerId: string) => void;
}) {
  const auctionState = state.auctionState;
  const live = auctionState.status === "LIVE" ? auctionState.currentPlayerId : null;
  const teamIndexById = new Map(state.teams.map((team, i) => [team._id, i]));

  const lastResultColor = auctionState.lastResult?.teamId
    ? teamColor(teamIndexById.get(auctionState.lastResult.teamId) ?? 0)
    : teamColor(0);

  if (!live) {
    const round = state.categories.find(
      (c) => c._id === auctionState.currentCategoryId
    );
    const waiting = state.pendingPlayers.filter(
      (player) =>
        player.status === "PENDING" &&
        (!round || player.categoryId?._id === round._id)
    );

    return (
      <>
        <div className="lot-head">
          <span className="catpill">{round ? `${round.name} round` : "No round"}</span>
          {round && (
            <span>
              {
                state.teams.filter((t) => (t.board?.rem?.[round._id] ?? 0) > 0)
                  .length
              }{" "}
              of {state.teams.length} teams still need a {round.name}
            </span>
          )}
        </div>

        {auctionState.lastResult && (
          <ResultStamp
            key={auctionState.lastResult.key}
            result={auctionState.lastResult}
            color={lastResultColor}
          />
        )}

        {waiting.length > 0 ? (
          <>
            <p className="player idle">
              {waiting.length} {waiting.length === 1 ? "player" : "players"} waiting
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn cream"
                disabled={busy}
                onClick={() => onBringUp(waiting[0]._id)}
              >
                Bring up next
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  onBringUp(
                    waiting[Math.floor(Math.random() * waiting.length)]._id
                  )
                }
              >
                Pick at random
              </button>
            </div>
            <p className="kbd">
              Or choose a player from the list. Keyboard: <kbd>N</kbd> next
            </p>
          </>
        ) : (
          <>
            <p className="player idle">Nobody is waiting in this round</p>
            <p className="lead-in">
              {state.categories.length === 0
                ? "Add player categories in Configuration to set up the rounds."
                : "Bring back unsold players from the list, or open the next round above."}
            </p>
          </>
        )}
      </>
    );
  }

  const bids = auctionState.bids;
  const last = bids.length ? bids[bids.length - 1] : null;
  const leadingIndex = last ? teamIndexById.get(last.teamId) ?? 0 : 0;
  const leading = last ? state.teams.find((t) => t._id === last.teamId) : null;

  const basePrice = state.lotBasePrice ?? 0;
  const minNext = state.minNextBid ?? basePrice;
  const eligible = state.teams.filter((team) => team.board?.limit?.ok);
  const invalidNext = nextBid < minNext - 1e-9;

  return (
    <>
      <div className="lot-head">
        <span className="catpill">{live.categoryId?.name ?? "Player"}</span>
        <span>Base ₹{fmt(basePrice)}</span>
        <span>Lot {auctionState.lotNo}</span>
      </div>

      <h1 className="player">
        {live.name}
        {live.role && <span className="g">{live.role}</span>}
      </h1>

      <div className="bidline">
        <div>
          <span className="lbl">{last ? "Current bid" : "Opening bid"}</span>
          <div className="plate">
            <span className="unit">₹</span>
            <span className="amount">{fmt(last ? last.amount : basePrice)}</span>
          </div>
        </div>

        {leading ? (
          <div>
            <span className="lbl">Leading</span>
            <div
              className="leader"
              style={{ ["--pc" as string]: teamColor(leadingIndex) }}
            >
              <span className="dot" aria-hidden="true" />
              {leading.name}
            </div>
          </div>
        ) : (
          <div>
            <span className="lbl">No bids yet</span>
            <div className="leader none">
              {eligible.length} of {state.teams.length} teams can bid
            </div>
          </div>
        )}

        <div className="nextbid">
          <label className="lbl" htmlFor="vpl-nextbid">
            Next bid
          </label>
          <div className="stepper">
            <button
              type="button"
              className="btn sq"
              aria-label="Lower the next bid"
              onClick={() =>
                onNextBidChange(
                  Math.max(minNext, nextBid - state.settings.bidIncrement)
                )
              }
            >
              −
            </button>
            <input
              id="vpl-nextbid"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={invalidNext || undefined}
              value={nextBid}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (Number.isFinite(parsed)) onNextBidChange(parsed);
              }}
            />
            <button
              type="button"
              className="btn sq"
              aria-label="Raise the next bid"
              onClick={() => onNextBidChange(nextBid + state.settings.bidIncrement)}
            >
              +
            </button>
          </div>
          <div className="minnote">At least ₹{fmt(minNext)}</div>
        </div>
      </div>

      <TeamPaddles
        teams={state.teams}
        bids={bids}
        nextBid={nextBid}
        minNext={minNext}
        busy={busy}
        onBid={onBid}
      />

      {!eligible.length && !last && (
        <p className="nobid">No team can bid on this player. Mark them unsold.</p>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn sell"
          disabled={!last || busy}
          onClick={onSell}
        >
          {last && leading
            ? `Sell to ${leading.name} for ₹${fmt(last.amount)}`
            : "Sell"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onUnsold}>
          Mark unsold
        </button>
        <button
          type="button"
          className="btn"
          disabled={!last || busy}
          onClick={onUndo}
        >
          Undo last bid
        </button>
      </div>

      <p className="kbd">
        Keyboard: <kbd>1</kbd> to <kbd>{Math.min(9, state.teams.length)}</kbd> bid
        for that team, <kbd>S</kbd> sell, <kbd>U</kbd> unsold, <kbd>Z</kbd> undo
        the last bid, <kbd>+</kbd> <kbd>−</kbd> change the next bid
      </p>
    </>
  );
}
