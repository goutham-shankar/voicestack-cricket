import { AuctionRoom } from "@/components/auction/auction-room";

export default function AdminAuctionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Live Auction</h1>
        <p className="text-sm text-muted-foreground">
          Start players if needed, manage the timer, and confirm each sale or mark
          a player unsold.
        </p>
      </div>
      <AuctionRoom role="admin" />
    </div>
  );
}
