"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactMoney } from "@/lib/auction-phase";
import type { FullAuctionState } from "@/lib/auction-types";

/**
 * The final round on the big screen: every power player at once.
 *
 * There is no lot on the block here, so the board shows the whole set and the
 * room watches them get claimed. Offers stay hidden until the admin reveals
 * them, which is the moment the round turns on.
 */
export function PowerRoundStage({ state }: { state: FullAuctionState }) {
  const round = state.auctionState.powerRound;
  const players = state.powerPlayers;

  const wonBy = new Set(
    players.map((p) => p.wonByTeamId).filter((id): id is string => Boolean(id))
  );
  const waiting = state.teams.filter((team) => !wonBy.has(team._id));
  const chosen = new Set(round.picks.map((pick) => pick.teamId));

  return (
    // The scrim behind this stage ramps darkness at the edges and leaves the
    // middle bright, which suits the two-column lot layouts. A full-width grid
    // sits right in that bright band, so it carries its own backdrop.
    <div className="flex w-full flex-col gap-7 rounded-3xl bg-black/72 p-8 ring-1 ring-white/10 backdrop-blur-md">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.42em] text-gold">
          Power Player Round
        </p>
        <p className="mt-2 text-lg font-bold uppercase tracking-[0.2em] text-white/80">
          {waiting.length === 0
            ? "All power players claimed"
            : round.revealed
              ? "Offers on the table"
              : `${chosen.size} of ${waiting.length} teams have chosen`}
        </p>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-5">
        {players.map((player) => {
          const offers = round.picks
            .filter((pick) => pick.playerId === player._id)
            .sort((a, b) => b.amount - a.amount);
          const won = player.status === "SOLD";

          return (
            <motion.div
              key={player._id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={[
                "flex w-56 flex-col items-center gap-3 rounded-2xl border p-4 backdrop-blur-sm",
                won
                  ? "border-sold/70 bg-sold/20"
                  : "border-white/15 bg-white/[0.07]",
              ].join(" ")}
            >
              <Avatar className="size-32 rounded-2xl ring-1 ring-white/15">
                {player.avatarUrl && (
                  <AvatarImage
                    src={player.avatarUrl}
                    alt=""
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="rounded-2xl bg-white/10 text-2xl font-black text-white">
                  {player.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="text-center">
                <p className="text-lg font-black leading-tight text-white">
                  {player.name}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {player.role}
                </p>
              </div>

              {won ? (
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-wider text-sold">
                    {player.wonByTeamName}
                  </p>
                  <p className="text-2xl font-black tabular-nums text-white">
                    {compactMoney(player.soldPrice ?? 0)}
                  </p>
                </div>
              ) : round.revealed && offers.length > 0 ? (
                <ul className="w-full space-y-1">
                  {offers.map((offer, i) => (
                    <li
                      key={offer.teamId}
                      className={[
                        "flex items-baseline justify-between gap-2 rounded px-2 py-1 text-xs",
                        i === 0
                          ? "bg-gold/20 font-black text-gold"
                          : "text-white/60",
                      ].join(" ")}
                    >
                      <span className="truncate">{offer.teamName}</span>
                      <span className="shrink-0 tabular-nums">
                        {compactMoney(offer.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-bold tabular-nums text-white/70">
                  {offers.length > 0
                    ? `${offers.length} offer${offers.length === 1 ? "" : "s"}`
                    : `Base ${compactMoney(player.basePrice)}`}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Who is still to choose, and what each has left to spend. */}
      {waiting.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {waiting.map((team) => (
            <div
              key={team._id}
              className={[
                "flex items-center gap-2 rounded-xl border px-3 py-2",
                chosen.has(team._id)
                  ? "border-gold/60 bg-gold/20"
                  : "border-white/15 bg-white/[0.06]",
              ].join(" ")}
            >
              <Avatar className="size-7 rounded-md">
                {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
                <AvatarFallback className="rounded-md bg-white/10 text-[10px] font-black text-white">
                  {team.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-xs font-bold text-white">{team.name}</p>
                <p className="text-[11px] tabular-nums text-white/55">
                  {compactMoney(team.remaining)} left
                  {chosen.has(team._id) ? " · chosen" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
