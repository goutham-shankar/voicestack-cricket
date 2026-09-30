import { connectDB } from "@/lib/db";
import PlayerModel from "@/models/Player";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Auction History</h1>
        <p className="text-sm text-muted-foreground">
          Every player&apos;s final outcome — who bought them and for how much.
        </p>
      </div>

      <HistoryTable players={serialize(players)} />
    </div>
  );
}
