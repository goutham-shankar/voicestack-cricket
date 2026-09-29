import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { playerSchema } from "@/lib/validators/player";
import PlayerModel from "@/models/Player";
import "@/models/PlayerCategory";
import "@/models/PlayerTag";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  await connectDB();
  const players = await PlayerModel.find()
    .populate("categoryId")
    .populate("tagIds")
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(players);
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = playerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const player = await PlayerModel.create(parsed.data);
  return NextResponse.json(player, { status: 201 });
}
