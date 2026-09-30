import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import PlayerModel from "@/models/Player";
import TeamModel from "@/models/Team";
import type { TeamSquad, SquadPlayer } from "@/lib/auction-types";

type SoldPlayer = {
  _id: unknown;
  name?: string;
  avatarUrl?: string | null;
  role?: string;
  soldPrice?: number | null;
  categoryId?: { name?: string } | null;
  soldToTeamId?: unknown;
};

/** Every team with the squad it bought — powers the end-of-auction showcase. */
export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  await connectDB();

  const [teams, sold] = await Promise.all([
    TeamModel.find({}).sort({ name: 1 }).lean(),
    PlayerModel.find({ status: "SOLD" })
      .populate("categoryId")
      .sort({ soldPrice: -1 })
      .lean() as unknown as Promise<SoldPlayer[]>,
  ]);

  const byTeam = new Map<string, SquadPlayer[]>();
  for (const p of sold) {
    const teamId = p.soldToTeamId ? String(p.soldToTeamId) : null;
    if (!teamId) continue;
    const list = byTeam.get(teamId) ?? [];
    list.push({
      _id: String(p._id),
      name: p.name ?? "",
      avatarUrl: p.avatarUrl ?? null,
      role: p.role ?? "",
      category: p.categoryId?.name ?? null,
      price: p.soldPrice ?? 0,
    });
    byTeam.set(teamId, list);
  }

  const squads: TeamSquad[] = teams.map((t) => {
    const players = byTeam.get(String(t._id)) ?? [];
    const spent = players.reduce((sum, p) => sum + p.price, 0);
    return {
      _id: String(t._id),
      name: t.name ?? "",
      logoUrl: t.logoUrl ?? null,
      spent,
      remaining: Math.max(0, (t.initialBudget ?? 0) - spent),
      maxSquadSize: t.maxSquadSize ?? 0,
      players,
    };
  });

  return NextResponse.json({ squads });
}
