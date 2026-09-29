import { connectDB } from "@/lib/db";
import PlayerModel from "@/models/Player";
import PlayerCategoryModel from "@/models/PlayerCategory";
import PlayerTagModel from "@/models/PlayerTag";
import { PlayersTable } from "@/components/admin/players/players-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminPlayersPage() {
  await connectDB();

  const [players, categories, tags] = await Promise.all([
    PlayerModel.find().populate("categoryId").populate("tagIds").sort({ createdAt: -1 }).lean(),
    PlayerCategoryModel.find().sort({ order: 1, name: 1 }).lean(),
    PlayerTagModel.find().sort({ name: 1 }).lean(),
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
