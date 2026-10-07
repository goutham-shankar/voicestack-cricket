"use client";

import { useState } from "react";
import { fmt, parseMoney } from "@/lib/auction-engine";
import type { FullAuctionState } from "@/lib/auction-types";
import { teamColor } from "@/components/auction/board/board-utils";

/**
 * The admin's console for the final round.
 *
 * Unlike every other round there is no lot on the block: all the power players
 * are available at once, each team names one and what it will pay, and the
 * highest offer takes a contested player. The admin types in what each team
 * calls out, reveals the offers on the display, then resolves. Teams that lost
 * a contest simply pick again.
 */
export function PowerRoundPanel({
  state,
  busy,
  onPick,
  onClear,
  onReveal,
  onResolve,
  onEnd,
}: {
  state: FullAuctionState;
  busy: boolean;
  onPick: (teamId: string, playerId: string, amount: number) => void;
  onClear: (teamId: string) => void;
  onReveal: (revealed: boolean) => void;
  onResolve: () => void;
  onEnd: () => void;
}) {
  const round = state.auctionState.powerRound;
  const players = state.powerPlayers;
  const available = players.filter((p) => p.status !== "SOLD");

  const wonBy = new Set(
    players.map((p) => p.wonByTeamId).filter((id): id is string => Boolean(id))
  );
  const waiting = state.teams.filter((team) => !wonBy.has(team._id));
  const pickByTeam = new Map(round.picks.map((pick) => [pick.teamId, pick]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Power Player round</p>
          <p className="text-sm text-muted-foreground">
            {waiting.length === 0
              ? "Every team has a power player."
              : `${round.picks.length} of ${waiting.length} teams have chosen.`}
          </p>
        </div>

        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          disabled={busy || !round.picks.length}
          onClick={() => onReveal(!round.revealed)}
        >
          {round.revealed ? "Hide offers" : "Reveal offers"}
        </button>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={busy || !round.picks.length}
          onClick={onResolve}
        >
          Resolve round
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          disabled={busy}
          onClick={onEnd}
        >
          End round
        </button>
      </div>

      {waiting.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Offers</h3>
          {waiting.map((team, i) => (
            <TeamOfferRow
              key={team._id}
              teamName={team.name}
              color={teamColor(i)}
              remaining={team.remaining}
              players={available}
              pick={pickByTeam.get(team._id) ?? null}
              busy={busy}
              onPick={(playerId, amount) => onPick(team._id, playerId, amount)}
              onClear={() => onClear(team._id)}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Power players</h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {players.map((player) => {
            const offers = round.picks.filter((p) => p.playerId === player._id);
            return (
              <li
                key={player._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
              >
                <span className="font-medium">{player.name}</span>
                <span className="text-xs text-muted-foreground">
                  base {fmt(player.basePrice)}
                </span>
                {player.wonByTeamName ? (
                  <span className="ml-auto text-sm font-semibold text-sold">
                    {player.wonByTeamName} · {fmt(player.soldPrice ?? 0)}
                  </span>
                ) : (
                  <span className="ml-auto text-sm text-muted-foreground">
                    {offers.length === 0
                      ? "no offers"
                      : offers
                          .map((o) => `${o.teamName} ${fmt(o.amount)}`)
                          .join(" · ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TeamOfferRow({
  teamName,
  color,
  remaining,
  players,
  pick,
  busy,
  onPick,
  onClear,
}: {
  teamName: string;
  color: string;
  remaining: number;
  players: FullAuctionState["powerPlayers"];
  pick: { playerId: string; amount: number } | null;
  busy: boolean;
  onPick: (playerId: string, amount: number) => void;
  onClear: () => void;
}) {
  const [playerId, setPlayerId] = useState(pick?.playerId ?? "");
  const [amountText, setAmountText] = useState(pick ? fmt(pick.amount) : "");

  // A resolve clears every pick, so follow the server rather than holding a
  // stale draft from the previous pass.
  const [seen, setSeen] = useState(pick);
  if (seen !== pick) {
    setSeen(pick);
    setPlayerId(pick?.playerId ?? "");
    setAmountText(pick ? fmt(pick.amount) : "");
  }

  const chosen = players.find((p) => p._id === playerId) ?? null;
  const amount = parseMoney(amountText);
  const valid =
    chosen != null &&
    amount != null &&
    amount >= chosen.basePrice &&
    amount <= remaining;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="min-w-36 font-medium">{teamName}</span>
      <span className="text-xs text-muted-foreground">{fmt(remaining)} left</span>

      <select
        className="min-w-44 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={playerId}
        disabled={busy}
        aria-label={`Power player for ${teamName}`}
        onChange={(e) => {
          setPlayerId(e.target.value);
          const next = players.find((p) => p._id === e.target.value);
          // Seed the offer at the base price — the common case is an uncontested
          // pick at base, and it shows the floor for a contested one.
          if (next && !amountText) setAmountText(fmt(next.basePrice));
        }}
      >
        <option value="">Choose a player…</option>
        {players.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>

      <input
        className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={amountText}
        disabled={busy || !chosen}
        aria-label={`Offer from ${teamName}`}
        placeholder={chosen ? fmt(chosen.basePrice) : "Offer"}
        onChange={(e) => setAmountText(e.target.value)}
      />

      <button
        type="button"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        disabled={busy || !valid}
        onClick={() => chosen && amount != null && onPick(chosen._id, amount)}
      >
        {pick ? "Update" : "Save"}
      </button>

      {pick && (
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          disabled={busy}
          onClick={onClear}
        >
          Clear
        </button>
      )}

      {chosen && amount != null && amount > remaining && (
        <span className="w-full text-xs text-destructive">
          Over {teamName}&apos;s remaining purse of {fmt(remaining)}.
        </span>
      )}
      {chosen && amount != null && amount < chosen.basePrice && (
        <span className="w-full text-xs text-destructive">
          Below the {fmt(chosen.basePrice)} base price.
        </span>
      )}
    </div>
  );
}
