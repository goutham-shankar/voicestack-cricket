import { ScrollArea } from "@/components/ui/scroll-area";
import type { BidRecord } from "@/lib/auction-types";

export function BidHistoryList({ bids }: { bids: BidRecord[] }) {
  if (bids.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No bids placed yet.
      </p>
    );
  }

  return (
    <ScrollArea className="h-56">
      <div className="space-y-1 pr-3">
        {bids.map((bid, i) => (
          <div
            key={bid._id}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            style={i === 0 ? { backgroundColor: "color-mix(in oklch, var(--primary) 12%, transparent)" } : undefined}
          >
            <span className="font-medium">{bid.teamId?.name ?? "Unknown team"}</span>
            <span className="tabular-money font-semibold text-primary">
              ₹{bid.amount.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
