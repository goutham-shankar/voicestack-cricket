import { Players } from "@/models/Player";
import { getCategories, getTags } from "@/lib/services/catalog";
import { populatePlayers } from "@/lib/services/populate";
import { PlayersTable } from "@/components/admin/players/players-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminPlayersPage() {
  const [players, categories, tags] = await Promise.all([
    Players.find(undefined, { sort: { order: 1, createdAt: 1 } }).then(populatePlayers),
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted-foreground">
          Manage the player catalog, categories, roles and tags.
        </p>
      </div>

      <PlayersTable
        initialPlayers={serialize(players)}
        categories={serialize(categories)}
        tags={serialize(tags)}
      />
    </div>
  );
}
