import { connectDB } from "@/lib/db";
import PlayerModel from "@/models/Player";
import BidModel from "@/models/Bid";
import { HistoryTable } from "@/components/admin/history/history-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminAuctionHistoryPage() {
  await connectDB();

  const players = await PlayerModel.find({ status: { $in: ["SOLD", "UNSOLD"] } })
    .populate("categoryId")
    .populate("tagIds")
    .populate("soldToTeamId")
    .sort({ updatedAt: -1 })
    .lean();

  const bids = await BidModel.find({
    playerId: { $in: players.map((p) => p._id) },
  })
    .populate("teamId")
    .sort({ createdAt: -1 })
    .lean();

  const bidsByPlayer = new Map<string, typeof bids>();
  for (const bid of bids) {
    const key = String(bid.playerId);
    if (!bidsByPlayer.has(key)) bidsByPlayer.set(key, []);
    bidsByPlayer.get(key)!.push(bid);
  }

  const rows = players.map((player) => ({
    player,
    bids: bidsByPlayer.get(String(player._id)) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Auction History</h1>
        <p className="text-sm text-muted-foreground">
          Every player&apos;s final outcome, including the full bid-by-bid history.
        </p>
      </div>

      <HistoryTable rows={serialize(rows)} />
    </div>
  );
}
