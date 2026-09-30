"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactMoney } from "@/lib/auction-phase";
import { cn } from "@/lib/utils";
import type { AuctionStats, RecentSale } from "@/lib/auction-types";

/** Broadcast statistics strip: four large readouts, no cards. */
export function StatsStrip({ stats }: { stats: AuctionStats }) {
  const items: Array<{ value: string; label: string; gold?: boolean }> = [
    { value: String(stats.sold), label: "Players Sold" },
    { value: compactMoney(stats.totalSpent), label: "Total Spent", gold: true },
    { value: String(stats.remaining), label: "Players Remaining" },
  ];
  return (
    <div className="flex shrink-0 items-stretch border-t border-white/10 bg-black/55">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-1 flex-col justify-center border-r border-white/8 px-8 py-4 last:border-r-0 xl:px-14"
        >
          <p
            className={cn(
              "tabular-money text-3xl font-black leading-none tracking-tight xl:text-4xl",
              item.gold ? "text-gold" : "text-white"
            )}
          >
            {item.value}
          </p>
          <p className="mt-2 text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/72">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Horizontally scrolling strip of completed sales. */
export function SalesTicker({ sales }: { sales: RecentSale[] }) {
  const topPrice = useMemo(
    () => (sales.length ? Math.max(...sales.map((s) => s.price)) : 0),
    [sales]
  );

  // Repeat short lists so the strip never shows a gap mid-loop.
  const group = useMemo(() => {
    if (sales.length === 0) return [];
    const reps = Math.max(1, Math.ceil(9 / sales.length));
    return Array.from({ length: reps }, () => sales).flat();
  }, [sales]);

  const duration = Math.max(group.length * 4.5, 28);

  return (
    <div className="flex h-[4.5rem] shrink-0 items-stretch border-t border-white/10 bg-black">
      <div className="flex shrink-0 items-center gap-3 bg-sold px-8 xl:px-10">
        <span className="size-2.5 rounded-full bg-sold-foreground/80" />
        <span className="text-sm font-black uppercase tracking-[0.3em] text-sold-foreground">
          Latest Sales
        </span>
      </div>

      {sales.length === 0 ? (
        <div className="flex flex-1 items-center px-10 text-base font-semibold text-white/62">
          No players sold yet — results appear here as lots are hammered.
        </div>
      ) : (
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
          }}
        >
          <div
            className="ticker-track flex h-full w-max items-stretch"
            style={{ animationDuration: `${duration}s` }}
          >
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-stretch">
                {group.map((sale, i) => {
                  const isTop = topPrice > 0 && sale.price === topPrice;
                  return (
                    <div
                      key={`${copy}-${sale._id}-${i}`}
                      className="flex shrink-0 items-center gap-4 border-r border-white/8 px-8"
                    >
                      <Avatar className="size-10 rounded-sm">
                        {sale.avatarUrl && (
                          <AvatarImage src={sale.avatarUrl} alt="" className="object-cover" />
                        )}
                        <AvatarFallback className="rounded-sm bg-white/10 text-xs font-black text-white/85">
                          {sale.playerName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="leading-tight">
                        <p className="max-w-[14rem] truncate text-lg font-black text-white">
                          {sale.playerName}
                        </p>
                        <p className="max-w-[14rem] truncate text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                          {sale.teamName}
                        </p>
                      </div>

                      <div className="ml-2 text-right leading-tight">
                        <p
                          className={cn(
                            "tabular-money text-xl font-black tracking-tight",
                            isTop ? "text-gold" : "text-white"
                          )}
                        >
                          ₹{sale.price.toLocaleString("en-IN")}
                        </p>
                        <p
                          className={cn(
                            "text-[0.6rem] font-black uppercase tracking-[0.24em]",
                            isTop ? "text-gold/80" : "text-sold"
                          )}
                        >
                          {isTop ? "Top Sale" : "Sold"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
