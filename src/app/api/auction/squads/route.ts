import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { Players } from "@/models/Player";
import { Teams } from "@/models/Team";
import { PlayerCategories } from "@/models/PlayerCategory";
import type { TeamSquad, SquadPlayer } from "@/lib/auction-types";

/** Every team with the squad it bought — powers the end-of-auction showcase. */
export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const [teams, sold, categories] = await Promise.all([
    Teams.find(undefined, { sort: { name: 1 } }),
    Players.find({ status: "SOLD" }, { sort: { soldPrice: -1 } }),
    PlayerCategories.find(),
  ]);

  const categoryNames = new Map(categories.map((c) => [c._id, c.name]));

  const byTeam = new Map<string, SquadPlayer[]>();
  for (const player of sold) {
    if (!player.soldToTeamId) continue;
    const list = byTeam.get(player.soldToTeamId) ?? [];
    list.push({
      _id: player._id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      role: player.role,
      category: categoryNames.get(player.categoryId) ?? null,
      price: player.soldPrice ?? 0,
    });
    byTeam.set(player.soldToTeamId, list);
  }

  const squads: TeamSquad[] = teams.map((team) => {
    const players = byTeam.get(team._id) ?? [];
    const spent = players.reduce((sum, player) => sum + player.price, 0);
    return {
      _id: team._id,
      name: team.name,
      logoUrl: team.logoUrl,
      spent,
      remaining: Math.max(0, team.initialBudget - spent),
      maxSquadSize: team.maxSquadSize,
      players,
    };
  });

  return NextResponse.json({ squads });
}
