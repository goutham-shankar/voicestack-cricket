import { Players } from "@/models/Player";
import { populatePlayersWithTeam } from "@/lib/services/populate";
import { HistoryTable } from "@/components/admin/history/history-table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminAuctionHistoryPage() {
  const settled = await populatePlayersWithTeam(
    await Players.find(
      { status: { $in: ["SOLD", "UNSOLD"] } },
      { sort: { updatedAt: -1 } }
    )
  );
  const players = settled.filter(
    (player): player is typeof player & { status: "SOLD" | "UNSOLD" } =>
      player.status === "SOLD" || player.status === "UNSOLD"
  );

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
