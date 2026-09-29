"use client";

import { Trophy } from "lucide-react";
import { AnimatedBidAmount } from "@/components/auction/animated-bid-amount";
import type { AuctionStateDTO, BidRecord } from "@/lib/auction-types";

export function BidPanel({
  auctionState,
  bidHistory,
}: {
  auctionState: AuctionStateDTO;
  bidHistory: BidRecord[];
}) {
  const previousBid = bidHistory[1];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
        <AnimatedBidAmount
          amount={auctionState.currentBid}
          size="md"
          label="Current Bid"
        />
      </div>

      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Leading Team
        </p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-lg font-semibold">
          {auctionState.currentBidTeamId ? (
            <>
              <Trophy className="size-4 text-primary" />
              {auctionState.currentBidTeamId.name}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Previous Bid
        </p>
        <p className="mt-1 text-lg font-semibold tabular-money">
          {previousBid ? `₹${previousBid.amount.toLocaleString("en-IN")}` : "—"}
        </p>
      </div>

      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Bids</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {auctionState.bidCount}
        </p>
      </div>
    </div>
  );
}
