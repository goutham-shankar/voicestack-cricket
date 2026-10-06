"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AuctionPhase } from "@/lib/auction-phase";

/**
 * A single bid on the current lot.
 *
 * Nothing produces these yet — bidding in this auction happens verbally and
 * only the winning team and hammer price are recorded. The rail is built
 * against this shape so a future bid feed can be passed straight in.
 */
export type BidEntry = {
  id: string;
  amount: number;
  teamName: string;
  teamLogoUrl: string | null;
};

function TeamCrest({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("rounded-full", className)}>
      {logoUrl && <AvatarImage src={logoUrl} alt="" className="object-cover" />}
      <AvatarFallback className="bg-white/10 font-black text-white">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function BidRail({
  phase,
  bids,
  basePrice,
  soldPrice,
  soldTeam,
}: {
  phase: AuctionPhase;
  bids: BidEntry[];
  basePrice: number;
  soldPrice?: number | null;
  soldTeam?: { name: string; logoUrl: string | null } | null;
}) {
  const top = bids[0] ?? null;
  const settled = phase === "SOLD";

  // The headline figure: hammer price once sold, else the leading bid, else
  // the opening price. Never a number the auction has not actually seen.
  const headline = settled ? (soldPrice ?? 0) : (top?.amount ?? basePrice);
  const hasBid = settled || top != null;

  /**
   * Rupee figures run long — "10,00,00,000" is twice the width of "20,00,000"
   * — and the headline must not wrap, so the face is sized to the number
   * rather than fixed. Without this the largest bids overflow the stage.
   */
  const headlineText = headline.toLocaleString("en-IN");
  const headlineFontSize =
    headlineText.length >= 12
      ? "clamp(2rem, 3.9vw, 4.5rem)"
      : headlineText.length >= 9
        ? "clamp(2.25rem, 4.7vw, 5.5rem)"
        : "clamp(2.75rem, 6.2vw, 7rem)";

  // Pulse the figure whenever it changes.
  const [pop, setPop] = useState(0);
  const prev = useRef(headline);
  useEffect(() => {
    if (prev.current !== headline) {
      prev.current = headline;
      setPop((n) => n + 1);
    }
  }, [headline]);

  const leader = settled ? soldTeam : top ? { name: top.teamName, logoUrl: top.teamLogoUrl } : null;

  return (
    <div className="flex min-w-0 flex-col justify-center gap-7 overflow-hidden text-right">
      {/* Headline figure */}
      <div>
        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-[0.72rem] font-black uppercase tracking-[0.36em]",
              settled ? "text-sold" : hasBid ? "text-gold" : "text-white/72"
            )}
          >
            {settled ? "Sold For" : hasBid ? "Current Bid" : "Opening Price"}
          </span>
          {!hasBid && phase !== "INTRO" && (
            <span className="rounded-sm bg-white/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/80">
              Awaiting first bid
            </span>
          )}
        </div>

        <motion.p
          key={pop}
          className={cn(
            "tabular-money mt-1 whitespace-nowrap font-black leading-[0.86] tracking-tighter animate-bid-pop",
            settled ? "text-sold" : hasBid ? "text-gold" : "text-white/92"
          )}
          style={{
            fontSize: headlineFontSize,
            textShadow: hasBid
              ? "0 0 70px color-mix(in oklch, var(--gold) 38%, transparent)"
              : undefined,
          }}
        >
          {headlineText}
        </motion.p>

        {hasBid && basePrice > 0 && (
          <p className="mt-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-white/68">
            Base {basePrice.toLocaleString("en-IN")}
          </p>
        )}
      </div>

      {/* Leading team + clock */}
      <div className="flex items-center justify-end gap-7">
        <AnimatePresence mode="wait">
          {leader ? (
            <motion.div
              key={leader.name}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex min-w-0 items-center justify-end gap-4"
            >
              <TeamCrest
                name={leader.name}
                logoUrl={leader.logoUrl}
                className={cn("size-20 ring-2", settled ? "ring-sold/70" : "ring-gold/70")}
              />
              <div className="min-w-0">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/72">
                  {settled ? "Winning Team" : "Highest Bid"}
                </p>
                <p className="mt-1 truncate text-3xl font-black tracking-tight text-white xl:text-4xl">
                  {leader.name}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="nobid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-semibold text-white/62"
            >
              No bids registered yet
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Recent bids */}
      {bids.length > 0 && (
        <div className="border-t border-white/10 pt-5">
          <p className="mb-3 text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/68">
            Recent Bids
          </p>
          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {bids.slice(0, 4).map((bid, i) => (
                <motion.li
                  key={bid.id}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.97 }}
                  animate={{ opacity: i === 0 ? 1 : 0.5 - i * 0.08, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="flex items-center justify-between gap-6"
                >
                  <span
                    className={cn(
                      "tabular-money text-2xl font-black tracking-tight",
                      i === 0 ? "text-gold" : "text-white"
                    )}
                  >
                    {bid.amount.toLocaleString("en-IN")}
                  </span>
                  <span className="flex items-center gap-2.5 truncate text-lg font-semibold text-white/90">
                    <TeamCrest name={bid.teamName} logoUrl={bid.teamLogoUrl} className="size-7" />
                    <span className="truncate">{bid.teamName}</span>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
