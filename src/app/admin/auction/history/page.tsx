import { connectDB } from "@/lib/db";
import PlayerModel from "@/models/Player";
import { HistoryTable } from "@/components/admin/history/history-table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Auction History</h1>
          <p className="text-sm text-muted-foreground">
            Every player&apos;s final outcome — who bought them and for how much.
          </p>
        </div>
        {/* Server sets Content-Disposition, so a plain anchor downloads it. */}
        <Button variant="outline" nativeButton={false} render={<a href="/api/auction/export" />}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <HistoryTable players={serialize(players)} />
    </div>
  );
}
