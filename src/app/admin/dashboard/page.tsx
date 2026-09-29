import { getFullState } from "@/lib/services/auction-service";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamOverviewTable } from "@/components/admin/team-overview-table";
import { Circle, Users, Trophy, Wallet, Gavel } from "lucide-react";

export default async function AdminDashboardPage() {
  const { stats, teams, auctionState } = await getFullState();
  const isLive = auctionState.status === "LIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Auction Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Operational overview of the current auction.
          </p>
        </div>
        <Badge
          className={
            isLive
              ? "gap-1.5 border-0 bg-live/15 text-live"
              : "gap-1.5 border border-unsold/60 bg-unsold/15 text-unsold-foreground"
          }
        >
          <Circle className="size-2 fill-current" />
          {isLive ? "Auction Live" : "Auction Not Started"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Teams" value={teams.length} icon={Users} accent="gold" />
        <StatCard label="Players Sold" value={stats.sold} icon={Trophy} accent="sold" />
        <StatCard label="Remaining" value={stats.remaining} icon={Gavel} />
        <StatCard
          label="Total Spent"
          value={`₹${stats.totalSpent.toLocaleString("en-IN")}`}
          icon={Wallet}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamOverviewTable teams={teams} />
        </CardContent>
      </Card>
    </div>
  );
}
