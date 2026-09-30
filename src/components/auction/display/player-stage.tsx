"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PHASE_META, type AuctionPhase } from "@/lib/auction-phase";
import type { PlayerRef } from "@/lib/auction-types";

const TONE_CLASS: Record<string, string> = {
  live: "bg-live text-white",
  gold: "bg-gold text-gold-foreground",
  sold: "bg-sold text-sold-foreground",
  unsold: "bg-unsold text-unsold-foreground",
  muted: "bg-white/12 text-white/90",
};

/** The phase chip that sits above the player's name. */
export function PhaseBadge({ phase }: { phase: AuctionPhase }) {
  const meta = PHASE_META[phase];
  return (
    <motion.span
      key={phase}
      initial={{ opacity: 0, y: -8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-sm px-4 py-2 text-sm font-black uppercase tracking-[0.28em]",
        TONE_CLASS[meta.tone],
        meta.urgent && "animate-state-urgent"
      )}
    >
      {meta.label}
    </motion.span>
  );
}

export function PlayerStage({
  player,
  phase,
}: {
  player: PlayerRef;
  phase: AuctionPhase;
}) {
  const intro = phase === "INTRO";

  return (
    <div className="flex min-w-0 items-end gap-8 overflow-hidden">
      {/* Portrait */}
      <motion.div
        initial={{ opacity: 0, x: -48, scale: 0.94 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 170, damping: 22 }}
        className="relative shrink-0"
      >
        <div
          aria-hidden
          className="absolute -inset-6 rounded-full bg-primary/25 blur-3xl"
        />
        <Avatar
          className={cn(
            "relative rounded-sm ring-1 ring-white/20",
            intro ? "size-[26rem]" : "size-72 xl:size-80"
          )}
          style={{ transition: "width 0.6s cubic-bezier(0.22,1,0.36,1), height 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        >
          {player.avatarUrl && (
            <AvatarImage src={player.avatarUrl} alt="" className="object-cover" />
          )}
          <AvatarFallback className="rounded-sm bg-white/8 text-8xl font-black text-white/85">
            {player.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {/* Identity */}
      <div className="min-w-0 flex-1 pb-2">
        <PhaseBadge phase={phase} />

        <p className="mt-5 text-base font-black uppercase tracking-[0.3em] text-primary">
          {player.role || player.categoryId?.name || "Player"}
        </p>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.08 }}
          className="mt-2 break-words font-black leading-[0.9] tracking-tighter text-white"
          style={{ fontSize: "clamp(2.25rem, 4vw, 4.25rem)", overflowWrap: "anywhere" }}
        >
          {player.name}
        </motion.h1>

        {/* Country / category sits under the name as supporting detail */}
        {player.categoryId?.name && (
          <p className="mt-4 text-xl font-bold uppercase tracking-[0.22em] text-white/78">
            {player.categoryId.name}
          </p>
        )}

        {player.tagIds.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {player.tagIds.map((tag, i) => (
              <motion.span
                key={tag._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="rounded-sm px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]"
                style={{ backgroundColor: `${tag.color}2e`, color: tag.color }}
              >
                {tag.name}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
