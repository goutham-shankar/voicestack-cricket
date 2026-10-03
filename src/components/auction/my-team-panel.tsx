"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function MyTeamPanel({ team }: { team: TeamSummary }) {
  const wallet = team.remaining; // cash left after completed purchases

  // The auction engine works these out server-side: money locked for rounds
  // that have not opened, and the most this team may bid in the round in play.
  const board = team.board;
  const slotReserve = board?.locked ?? 0;
  const maxNextBuy = board ? (board.limit.ok ? board.limit.max : 0) : wallet;
  const blockedReason = board && !board.limit.ok ? board.limit.reason : null;

  const budget = team.initialBudget || 1;
  const spentPct = Math.min(100, (team.spent / budget) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">
        <Avatar className="size-14 rounded-xl">
          {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
          <AvatarFallback className="rounded-xl bg-secondary text-sm">
            {team.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{team.name}</p>
          <p className="text-sm text-muted-foreground">
            Squad {team.squadCount}/{team.maxSquadSize}
            {slotReserve > 0 && (
              <>
                {" "}
                · ₹{slotReserve.toLocaleString("en-IN")} locked for later rounds
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <PurseStat
          label="Wallet"
          hint="After purchases"
          value={wallet}
          accent="primary"
        />
        <PurseStat
          label="Spent"
          hint="Across purchases"
          value={team.spent}
          accent="muted"
        />
        <PurseStat
          label="Max next bid"
          hint={blockedReason ?? "Keeps the squad fillable"}
          value={maxNextBuy}
          accent="sold"
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
            className="absolute inset-y-0 left-0 bg-primary/70"
            style={{ width: `${spentPct}%` }}
          />
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
