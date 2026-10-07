"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { fmt, incrementFor, parseMoney } from "@/lib/auction-engine";
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
              settings={state.settings}
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

      {/* The same set of faces the room is looking at on the display, so the
          admin is reading the same board rather than a list of names. */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Power players</h3>
        <div className="flex flex-wrap gap-3">
          {players.map((player) => {
            const offers = round.picks
              .filter((p) => p.playerId === player._id)
              .sort((a, b) => b.amount - a.amount);
            const won = Boolean(player.wonByTeamName);

            return (
              <div
                key={player._id}
                className={cn(
                  "flex w-44 flex-col items-center gap-2 rounded-xl border p-3 text-center",
                  won ? "border-sold/50 bg-sold/10" : "border-border bg-card"
                )}
              >
                <Avatar className="size-20 rounded-xl">
                  {player.avatarUrl && (
                    <AvatarImage
                      src={player.avatarUrl}
                      alt=""
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="rounded-xl bg-secondary text-lg font-bold">
                    {player.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {player.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    base {fmt(player.basePrice)}
                  </p>
                </div>

                {won ? (
                  <p className="mt-auto text-xs font-semibold text-sold">
                    {player.wonByTeamName}
                    <br />
                    {fmt(player.soldPrice ?? 0)}
                  </p>
                ) : offers.length === 0 ? (
                  <p className="mt-auto text-xs text-muted-foreground">
                    No offers
                  </p>
                ) : (
                  <ul className="mt-auto w-full space-y-0.5">
                    {offers.map((offer, i) => (
                      <li
                        key={offer.teamId}
                        className={cn(
                          "flex items-baseline justify-between gap-1 rounded px-1.5 py-0.5 text-[11px]",
                          i === 0
                            ? "bg-primary/15 font-semibold text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">{offer.teamName}</span>
                        <span className="shrink-0 tabular-nums">
                          {fmt(offer.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamOfferRow({
  settings,
  teamName,
  color,
  remaining,
  players,
  pick,
  busy,
  onPick,
  onClear,
}: {
  settings: FullAuctionState["settings"];
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

      {/* The face of whoever this team is going for, so the admin can see at a
          glance that the right player is selected. */}
      <Avatar className="size-9 rounded-lg">
        {chosen?.avatarUrl && (
          <AvatarImage src={chosen.avatarUrl} alt="" className="object-cover" />
        )}
        <AvatarFallback className="rounded-lg bg-secondary text-[10px]">
          {chosen ? chosen.name.slice(0, 2).toUpperCase() : "—"}
        </AvatarFallback>
      </Avatar>

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

      {/* The same stepper the general round uses for the next bid: nudge by the
          configured increment, and read and accept money as the room says it. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="size-8 shrink-0 rounded-md border border-border text-lg leading-none hover:bg-accent disabled:opacity-40"
          aria-label={`Lower the offer from ${teamName}`}
          disabled={busy || !chosen}
          onClick={() => {
            if (!chosen) return;
            const from = amount ?? chosen.basePrice;
            setAmountText(
              fmt(Math.max(chosen.basePrice, from - incrementFor(from, settings)))
            );
          }}
        >
          −
        </button>

        <input
          className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm tabular-nums"
          value={amountText}
          disabled={busy || !chosen}
          inputMode="text"
          autoComplete="off"
          aria-label={`Offer from ${teamName}`}
          placeholder={chosen ? fmt(chosen.basePrice) : "Offer"}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setAmountText(e.target.value)}
        />

        <button
          type="button"
          className="size-8 shrink-0 rounded-md border border-border text-lg leading-none hover:bg-accent disabled:opacity-40"
          aria-label={`Raise the offer from ${teamName}`}
          disabled={busy || !chosen}
          onClick={() => {
            if (!chosen) return;
            const from = amount ?? chosen.basePrice;
            setAmountText(fmt(from + incrementFor(from, settings)));
          }}
        >
          +
        </button>
      </div>

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
