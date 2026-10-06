import { AuctionRoom } from "@/components/auction/auction-room";

export default function AuctioneerAuctionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Live Auction</h1>
        <p className="text-sm text-muted-foreground">
          Read-only view of the room — the current lot, every bid, and each
          team&apos;s remaining purse. Only an admin can run the lots.
        </p>
      </div>
      <AuctionRoom role="auctioneer" myTeam={null} />
    </div>
  );
}
