import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { playerSchema } from "@/lib/validators/player";
import PlayerModel from "@/models/Player";
import "@/models/PlayerCategory";
import "@/models/PlayerTag";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await connectDB();
  const player = await PlayerModel.findById(id)
    .populate("categoryId")
    .populate("tagIds")
    .lean();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  return NextResponse.json(player);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = playerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const player = await PlayerModel.findById(id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.status === "SOLD") {
    return NextResponse.json(
      { error: "A sold player's record cannot be edited" },
      { status: 409 }
    );
  }
  if (player.status === "LIVE") {
    return NextResponse.json(
      { error: "A live player's record cannot be edited during the auction" },
      { status: 409 }
    );
  }

  Object.assign(player, parsed.data);
  await player.save();
  return NextResponse.json(player);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await connectDB();

  const player = await PlayerModel.findById(id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.status === "SOLD") {
    return NextResponse.json(
      { error: "A sold player cannot be deleted" },
      { status: 409 }
    );
  }
  if (player.status === "LIVE") {
    return NextResponse.json(
      { error: "A live player cannot be deleted during the auction" },
      { status: 409 }
    );
  }

  await player.deleteOne();
  return NextResponse.json({ ok: true });
}
