import { StatCard } from "@/components/stat-card";
import { Users, Trophy, Gavel, Wallet, TrendingUp, Circle } from "lucide-react";
import type { AuctionStats } from "@/lib/auction-types";

export function StatsBar({ stats }: { stats: AuctionStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Total Players" value={stats.totalPlayers} icon={Users} />
      <StatCard label="Sold" value={stats.sold} icon={Trophy} accent="sold" />
      <StatCard label="Unsold" value={stats.unsold} icon={Circle} accent="unsold" />
      <StatCard label="Remaining" value={stats.remaining} icon={Gavel} accent="gold" />
      <StatCard
        label="Total Spent"
        value={`${stats.totalSpent.toLocaleString("en-IN")}`}
        icon={Wallet}
      />
      <StatCard
        label="Highest Sale"
        value={`${stats.highestSale.toLocaleString("en-IN")}`}
        icon={TrendingUp}
        accent="gold"
      />
    </div>
  );
}
