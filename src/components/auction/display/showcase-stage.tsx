"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactMoney } from "@/lib/auction-phase";
import { cn } from "@/lib/utils";
import type { TeamSquad, SquadPlayer } from "@/lib/auction-types";

/** How long each team holds the screen. */
const HOLD_MS = 10000;

/**
 * Rotation is anchored at module scope so a remount of this component (the
 * board re-renders on every auction:state push) cannot reset the carousel
 * back to the first team. Squads are cached for the same reason.
 */
let rotationAnchor = 0;
let squadCache: TeamSquad[] | null = null;

const ROLE_ORDER = ["Batsman", "All-rounder", "Bowler", "Wicketkeeper"] as const;

function bucketOf(role: string): string {
  const r = role.trim().toLowerCase();
  if (!r) return "Other";
  if (r.includes("wicket") || r.includes("keeper")) return "Wicketkeeper";
  if (r.includes("all")) return "All-rounder";
  if (r.includes("bowl")) return "Bowler";
  if (r.includes("bat")) return "Batsman";
  return role;
}

function groupByRole(players: SquadPlayer[]) {
  const groups = new Map<string, SquadPlayer[]>();
  for (const p of players) {
    const key = bucketOf(p.role);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a[0] as (typeof ROLE_ORDER)[number]);
    const bi = ROLE_ORDER.indexOf(b[0] as (typeof ROLE_ORDER)[number]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

export function ShowcaseStage() {
  const [squads, setSquads] = useState<TeamSquad[] | null>(squadCache);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (squadCache) return;
    let cancelled = false;
    fetch("/api/auction/squads")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.squads) return;
        squadCache = d.squads as TeamSquad[];
        setSquads(squadCache);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Drive the carousel off wall-clock elapsed time rather than a counter, so
  // the position is recomputed correctly even after a remount.
  useEffect(() => {
    if (!rotationAnchor) rotationAnchor = Date.now();
    const tick = () => setElapsed(Date.now() - rotationAnchor);
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  const count = squads?.length ?? 0;
  const index = count > 0 ? Math.floor(elapsed / HOLD_MS) % count : 0;
  const team = squads && count > 0 ? squads[index] : null;
  const groups = useMemo(() => (team ? groupByRole(team.players) : []), [team]);

  if (!squads || !team) {
    return (
      <p className="w-full text-center text-2xl font-black uppercase tracking-[0.3em] text-white/72">
        {squads ? "No teams to show" : "Loading final squads…"}
      </p>
    );
  }

  // Spread a large squad across more columns so every name stays on screen.
  const total = team.players.length;
  const cols = total > 12 ? "columns-3" : total > 6 ? "columns-2" : "columns-1";

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center justify-between gap-6">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.42em] text-primary">
          Final Squads
        </p>
        <div className="flex items-center gap-2">
          {squads.map((s, i) => (
            <span
              key={s._id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i === index ? "w-10 bg-gold" : "w-4 bg-white/25"
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={team._id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-5"
        >
          {/* Team header — identity only */}
          <div className="flex items-center gap-5 border-b border-white/12 pb-4">
            <Avatar className="size-20 rounded-full ring-2 ring-primary/60">
              {team.logoUrl && (
                <AvatarImage src={team.logoUrl} alt="" className="object-cover" />
              )}
              <AvatarFallback className="bg-white/10 text-xl font-black text-white">
                {team.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2
              className="min-w-0 flex-1 truncate font-black leading-none tracking-tighter text-white"
              style={{ fontSize: "clamp(2rem, 3.8vw, 3.75rem)" }}
            >
              {team.name}
            </h2>
            <p className="shrink-0 text-2xl font-black uppercase tracking-[0.2em] text-white/72">
              {total}
              {team.maxSquadSize ? ` / ${team.maxSquadSize}` : ""} Players
            </p>
          </div>

          {/* Squad, grouped by role, flowed into columns */}
          {total === 0 ? (
            <p className="py-8 text-center text-2xl font-bold text-white/62">
              No players bought.
            </p>
          ) : (
            <div className={cn(cols, "gap-x-12")}>
              {groups.map(([role, players]) => (
                <div key={role} className="mb-5 break-inside-avoid">
                  <div className="mb-2 flex items-baseline justify-between border-b border-white/12 pb-1">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.28em] text-primary">
                      {role}
                    </p>
                    <p className="text-[0.62rem] font-black tabular-nums text-white/62">
                      {players.length}
                    </p>
                  </div>

                  <ul className="flex flex-col gap-1.5">
                    {players.map((p) => (
                      <li key={p._id} className="flex items-center gap-2.5">
                        <Avatar className="size-8 shrink-0 rounded-sm">
                          {p.avatarUrl && (
                            <AvatarImage src={p.avatarUrl} alt="" className="object-cover" />
                          )}
                          <AvatarFallback className="rounded-sm bg-white/10 text-[9px] font-black text-white/72">
                            {p.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-white">
                          {p.name}
                        </span>
                        <span className="tabular-money shrink-0 text-lg font-black text-gold">
                          {compactMoney(p.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
