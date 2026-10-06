import { auth } from "@/auth";
import { Players } from "@/models/Player";
import { populatePlayers } from "@/lib/services/populate";
import { getUserTeam, getUserTeamId } from "@/lib/session-team";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users2, Wallet, Sparkles } from "lucide-react";

export default async function TeamSquadPage() {
  const session = await auth();

  const team = await getUserTeam(session?.user?.id);
  const teamId = await getUserTeamId(session?.user?.id);

  const players = teamId
    ? await populatePlayers(
        await Players.find(
          { soldToTeamId: teamId, status: "SOLD" },
          { sort: { updatedAt: -1 } }
        )
      )
    : [];

  const totalSpent = players.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0);
  const avgPrice = players.length ? Math.round(totalSpent / players.length) : 0;

  const tagCounts = new Map<string, number>();
  for (const p of players) {
    for (const tag of p.tagIds) {
      tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {team?.name ?? "Your"} Squad
        </h1>
        <p className="text-sm text-muted-foreground">
          {players.length} / {team?.maxSquadSize ?? 0} players acquired.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Players" value={players.length} icon={Users2} />
        <StatCard
          label="Total Spent"
          value={`₹${totalSpent.toLocaleString("en-IN")}`}
          icon={Wallet}
        />
        <StatCard
          label="Avg. Price"
          value={`₹${avgPrice.toLocaleString("en-IN")}`}
          icon={Wallet}
          accent="gold"
        />
        <StatCard
          label="Tagged Players"
          value={[...tagCounts.values()].reduce((a, b) => a + b, 0)}
          icon={Sparkles}
        />
      </div>

      {tagCounts.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...tagCounts.entries()].map(([name, count]) => (
            <Badge key={name} variant="secondary" className="font-normal">
              {name}: {count}
            </Badge>
          ))}
        </div>
      )}

      {players.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Users2 className="size-8" />
            <p className="text-sm">No players acquired yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => {
            const category = player.categoryId;
            const tags = player.tagIds;
            return (
              <Card key={player._id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12 rounded-xl">
                      {player.avatarUrl && (
                        <AvatarImage src={player.avatarUrl} alt="" />
                      )}
                      <AvatarFallback className="rounded-xl bg-secondary">
                        {player.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold leading-tight">{player.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {player.role} · {category?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Purchase Price</span>
                    <span className="font-semibold tabular-money text-primary">
                      ₹{(player.soldPrice ?? 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Badge
                          key={tag._id}
                          className="border-0 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ backgroundColor: `${tag.color}26`, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
