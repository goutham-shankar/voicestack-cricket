"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactMoney } from "@/lib/auction-phase";
import { cn } from "@/lib/utils";
import type { FullAuctionState, PowerPlayerDTO } from "@/lib/auction-types";

/**
 * The final round on the big screen: every power player at once.
 *
 * There is no lot on the block here, so the board shows the whole set and the
 * room watches them get claimed. Offers stay hidden until the admin reveals
 * them, which is the moment the round turns on.
 *
 * The stage sits straight on the match footage with no panel behind it, so each
 * card carries its own dark plate and the headings lean on a text shadow.
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
    <div className="flex w-full flex-col gap-5 xl:gap-6">
      <div className="text-center [text-shadow:0_2px_16px_rgb(0_0_0_/_0.95)]">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-black uppercase tracking-[0.5em] text-gold xl:text-lg"
        >
          Power Player Round
        </motion.p>
        <p className="mt-2 text-base font-bold uppercase tracking-[0.24em] text-white xl:text-xl">
          {waiting.length === 0
            ? "All power players claimed"
            : round.revealed
              ? "Offers on the table"
              : `${chosen.size} of ${waiting.length} teams have chosen`}
        </p>
      </div>

      {/* One row, always. The cards share the width rather than holding a fixed
          size, because the round is read as a set and a card wrapping onto a
          second line lands on top of the stats strip. `basis-0` + `flex-1`
          lets five of anything fit, and the max-width stops them ballooning on
          a very wide board. */}
      <div className="flex w-full items-stretch justify-center gap-2.5 lg:gap-3.5 xl:gap-4">
        {players.map((player, i) => (
          <PowerCard
            key={player._id}
            player={player}
            index={i}
            offers={round.picks
              .filter((pick) => pick.playerId === player._id)
              .sort((a, b) => b.amount - a.amount)}
            revealed={round.revealed}
          />
        ))}
      </div>
    </div>
  );
}

type Offer = { teamId: string; teamName: string; amount: number };

function PowerCard({
  player,
  index,
  offers,
  revealed,
}: {
  player: PowerPlayerDTO;
  index: number;
  offers: Offer[];
  revealed: boolean;
}) {
  const won = player.status === "SOLD";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 24, delay: index * 0.07 }}
      className={cn(
        "relative flex min-w-0 flex-1 basis-0 flex-col items-center gap-2 overflow-hidden rounded-2xl border p-3 backdrop-blur-md",
        "max-w-52 lg:gap-3 lg:p-4 xl:max-w-60",
        won
          ? "border-sold/70 bg-sold/25 shadow-[0_0_48px_-14px_var(--sold)]"
          : "border-white/20 bg-black/60"
      )}
    >
      {/* A claimed player keeps a soft wash of the result colour behind them. */}
      {won && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sold/35 to-transparent"
        />
      )}

      <div className="relative">
        <div
          aria-hidden
          className={cn(
            "absolute -inset-3 rounded-full blur-2xl",
            won ? "bg-sold/40" : "bg-primary/25"
          )}
        />
        {/* An explicit square rather than `w-full aspect-square`: the fallback
            does not stretch the way an image does, so a player without a photo
            collapsed to a fraction of the size next to one with. */}
        <Avatar className="relative size-28 rounded-xl ring-1 ring-white/25 xl:size-36">
          {player.avatarUrl && (
            <AvatarImage src={player.avatarUrl} alt="" className="object-cover" />
          )}
          <AvatarFallback className="rounded-xl bg-white/10 text-4xl font-black text-white/85">
            {player.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="relative text-center">
        <p
          className="font-black uppercase leading-[0.95] tracking-tight text-white"
          style={{ fontSize: "clamp(0.95rem, 1.15vw, 1.35rem)", overflowWrap: "anywhere" }}
        >
          {player.name}
        </p>
        <p className="mt-1.5 text-[0.7rem] font-black uppercase tracking-[0.24em] text-primary xl:text-xs">
          {player.role || "Power Player"}
        </p>
      </div>

      <div className="relative mt-auto w-full">
        {won ? (
          // The winning team only — what they paid is the auctioneer's business,
          // not the board's, once the player is claimed.
          <p
            className="text-center font-black uppercase leading-tight tracking-[0.18em] text-sold"
            style={{ fontSize: "clamp(0.8rem, 0.95vw, 1.05rem)" }}
          >
            {player.wonByTeamName}
          </p>
        ) : revealed && offers.length > 0 ? (
          <ul className="space-y-1">
            {offers.map((offer, i) => (
              <li
                key={offer.teamId}
                className={cn(
                  "flex items-baseline justify-between gap-2 rounded px-2 py-1.5 text-xs xl:text-sm",
                  i === 0
                    ? "bg-gold/25 font-black text-gold"
                    : "font-semibold text-white/75"
                )}
              >
                <span className="truncate">{offer.teamName}</span>
                <span className="shrink-0 tabular-nums">
                  {compactMoney(offer.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-white/55">
              {offers.length > 0 ? "Offers in" : "Base price"}
            </p>
            <p
              className="font-black tabular-nums leading-none text-white"
              style={{ fontSize: "clamp(1.15rem, 1.5vw, 1.75rem)" }}
            >
              {offers.length > 0
                ? `${offers.length}`
                : compactMoney(player.basePrice)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
