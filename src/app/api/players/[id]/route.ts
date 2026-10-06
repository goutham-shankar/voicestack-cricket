import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { playerSchema } from "@/lib/validators/player";
import { Players } from "@/models/Player";
import { populatePlayer } from "@/lib/services/populate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const player = await Players.findById(id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  return NextResponse.json(await populatePlayer(player));
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

  const player = await Players.findById(id);
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

  const updated = await Players.updateById(id, parsed.data);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const player = await Players.findById(id);
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

  await Players.deleteById(id);
  return NextResponse.json({ ok: true });
}
