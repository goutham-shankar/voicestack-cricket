"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TeamSummary } from "@/lib/auction-types";

type SquadPlayer = {
  _id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  soldPrice: number | null;
  categoryId?: { name: string } | null;
};

export function MyTeamPanel({
  team,
  leadingTeamId,
  currentBid = 0,
  minReservePerSlot = 0,
}: {
  team: TeamSummary;
  leadingTeamId?: string | null;
  currentBid?: number;
  minReservePerSlot?: number;
}) {
  const isLeading = String(team._id) === String(leadingTeamId) && currentBid > 0;
  const wallet = team.remaining; // cash left after completed purchases
  const inBid = isLeading ? currentBid : 0;
  // Purse still free after locking the current high bid
  const freeToAllocate = Math.max(0, wallet - inBid);

  // Max they can still put on a new bid (keep reserve for remaining slots after a win)
  const slotsAfterWin = Math.max(0, team.slotsRemaining - 1);
  const slotReserve = slotsAfterWin * minReservePerSlot;
  const maxBidAllowed = Math.max(0, wallet - slotReserve);

  const budget = team.initialBudget || 1;
  const spentPct = Math.min(100, (team.spent / budget) * 100);
  const inBidPct = Math.min(100 - spentPct, (inBid / budget) * 100);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-xl border p-4",
          isLeading ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        <Avatar className="size-14 rounded-xl">
          {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
          <AvatarFallback className="rounded-xl bg-secondary text-sm">
            {team.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{team.name}</p>
            {isLeading && (
              <Badge className="border-0 bg-primary/15 text-primary">Leading bid</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Squad {team.squadCount}/{team.maxSquadSize}
            {slotReserve > 0 && (
              <>
                {" "}
                · keep ₹{slotReserve.toLocaleString("en-IN")} for remaining slots
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PurseStat
          label="Wallet"
          hint="After purchases"
          value={wallet}
          accent="primary"
        />
        <PurseStat
          label="In bid"
          hint={isLeading ? "Locked on this lot" : "Not leading"}
          value={inBid}
          accent={inBid > 0 ? "live" : "muted"}
          empty={!inBid}
        />
        <PurseStat
          label="Free to allocate"
          hint="Wallet minus in-bid"
          value={freeToAllocate}
          accent="sold"
        />
        <PurseStat
          label="Max bid now"
          hint="After slot reserve"
          value={maxBidAllowed}
          accent="primary"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-border px-4 py-3">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Spent{" "}
            <span className="font-medium text-foreground tabular-money">
              ₹{team.spent.toLocaleString("en-IN")}
            </span>
          </span>
          <span>
            Budget{" "}
            <span className="font-medium text-foreground tabular-money">
              ₹{team.initialBudget.toLocaleString("en-IN")}
            </span>
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-muted-foreground/40"
            style={{ width: `${spentPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-live/80"
            style={{ left: `${spentPct}%`, width: `${inBidPct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" /> Spent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-live/80" /> In bid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted" /> Free
          </span>
        </div>
      </div>
    </div>
  );
}

function PurseStat({
  label,
  hint,
  value,
  accent,
  empty,
}: {
  label: string;
  hint: string;
  value: number;
  accent: "primary" | "live" | "sold" | "muted";
  empty?: boolean;
}) {
  const valueClass = {
    primary: "text-primary",
    live: "text-live",
    sold: "text-sold",
    muted: "text-muted-foreground",
  }[accent];

  return (
    <div className="rounded-xl border border-border bg-card/40 px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 tabular-money text-lg font-semibold", valueClass)}>
        {empty ? "—" : `₹${value.toLocaleString("en-IN")}`}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function MySquadList({
  teamId,
  refreshKey = 0,
}: {
  teamId: string;
  refreshKey?: number;
}) {
  const [squad, setSquad] = useState<SquadPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/players")
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (
          players: Array<
            SquadPlayer & {
              status: string;
              soldToTeamId: string | { _id: string } | null;
            }
          >
        ) => {
          if (cancelled) return;
          const mine = players.filter((p) => {
            if (p.status !== "SOLD" || !p.soldToTeamId) return false;
            const soldTo =
              typeof p.soldToTeamId === "string"
                ? p.soldToTeamId
                : String(p.soldToTeamId._id);
            return String(soldTo) === String(teamId);
          });
          setSquad(mine);
        }
      )
      .catch(() => {
        if (!cancelled) setSquad([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, refreshKey]);

  if (squad.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No players won yet — place bids when a lot goes live.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {squad.map((player) => (
        <li key={player._id} className="flex items-center gap-3 px-3 py-2.5">
          <Avatar className="size-9">
            {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" />}
            <AvatarFallback className="bg-secondary text-xs">
              {player.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{player.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {player.role}
              {player.categoryId?.name ? ` · ${player.categoryId.name}` : ""}
            </p>
          </div>
          <p className="tabular-money text-sm font-semibold">
            ₹{(player.soldPrice ?? 0).toLocaleString("en-IN")}
          </p>
        </li>
      ))}
    </ul>
  );
}
