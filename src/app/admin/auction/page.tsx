import { AuctionBoard } from "@/components/auction/board/auction-board";

export default function AdminAuctionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Live Auction</h1>
        <p className="text-sm text-muted-foreground">
          Open a round, bring up a player, take bids with the team paddles, then
          sell to the leading bid or mark the player unsold.
        </p>
      </div>
      <AuctionBoard />
    </div>
  );
}
