import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { playerSchema } from "@/lib/validators/player";
import { Players } from "@/models/Player";
import { populatePlayers } from "@/lib/services/populate";

/** One past the highest roster position currently in use. */
async function nextOrder() {
  const players = await Players.find();
  return players.reduce((max, player) => Math.max(max, player.order ?? 0), -1) + 1;
}

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const players = await Players.find(undefined, { sort: { order: 1, createdAt: 1 } });
  return NextResponse.json(await populatePlayers(players));
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = playerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // New players join the end of the roster rather than jumping to the top.
  const player = await Players.create({ ...parsed.data, order: await nextOrder() });
  return NextResponse.json(player, { status: 201 });
}
