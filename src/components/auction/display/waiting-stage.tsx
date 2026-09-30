"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactMoney } from "@/lib/auction-phase";
import { cn } from "@/lib/utils";
import type { AuctionStats, RecentSale } from "@/lib/auction-types";

/**
 * Between lots. Deliberately does NOT reveal who is coming up next — the board
 * is public, so the queue stays with the auctioneer. Fills the stage with what
 * has already happened instead.
 */
export function WaitingStage({
  stats,
  sales,
}: {
  stats: AuctionStats;
  sales: RecentSale[];
}) {
  const board = [...sales].sort((a, b) => b.price - a.price).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.45 }}
      className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-16"
    >
      {/* Status */}
      <div>
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block rounded-sm bg-white/12 px-4 py-2 text-sm font-black uppercase tracking-[0.28em] text-white/85"
        >
          Standing By
        </motion.span>

        <h2
          className="mt-6 font-black leading-[0.88] tracking-tighter text-white"
          style={{ fontSize: "clamp(2.75rem, 5.2vw, 5.5rem)" }}
        >
          Next Lot
          <br />
          Shortly
        </h2>

        <div className="mt-9 grid grid-cols-2 gap-x-10 gap-y-6 border-t border-white/12 pt-7">
          {[
            ["Players Sold", String(stats.sold)],
            ["Remaining", String(stats.remaining)],
            ["Total Spent", compactMoney(stats.totalSpent), true],
            ["Highest Sale", compactMoney(stats.highestSale), true],
          ].map(([label, value, gold]) => (
            <div key={String(label)}>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/68">
                {label}
              </p>
              <p
                className={cn(
                  "tabular-money mt-1.5 text-4xl font-black tracking-tight",
                  gold ? "text-gold" : "text-white"
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Biggest buys so far */}
      <div>
        <p className="mb-4 text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/68">
          Biggest Buys
        </p>

        {board.length === 0 ? (
          <p className="text-xl font-semibold text-white/62">
            No players sold yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {board.map((sale, i) => (
              <motion.li
                key={sale._id}
                initial={{ opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={cn(
                  "flex items-center gap-4 border-l-2 pl-4",
                  i === 0 ? "border-gold" : "border-white/15"
                )}
              >
                <span
                  className={cn(
                    "tabular-money w-7 shrink-0 text-2xl font-black",
                    i === 0 ? "text-gold" : "text-white/50"
                  )}
                >
                  {i + 1}
                </span>

                <Avatar className="size-14 shrink-0 rounded-sm">
                  {sale.avatarUrl && (
                    <AvatarImage src={sale.avatarUrl} alt="" className="object-cover" />
                  )}
                  <AvatarFallback className="rounded-sm bg-white/10 text-base font-black text-white/70">
                    {sale.playerName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-2xl font-black text-white">
                    {sale.playerName}
                  </p>
                  <p className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-white/68">
                    {sale.teamName}
                  </p>
                </div>

                <p
                  className={cn(
                    "tabular-money shrink-0 text-3xl font-black tracking-tight",
                    i === 0 ? "text-gold" : "text-white"
                  )}
                >
                  {compactMoney(sale.price)}
                </p>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
