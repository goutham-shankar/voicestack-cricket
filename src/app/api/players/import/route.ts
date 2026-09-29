import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { playerSchema } from "@/lib/validators/player";
import PlayerModel from "@/models/Player";
import "@/models/PlayerCategory";
import "@/models/PlayerTag";

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const rows = Array.isArray(body.players) ? body.players : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "No players to import" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: "Import is limited to 500 players per file" },
      { status: 400 }
    );
  }

  const valid: (typeof playerSchema)["_output"][] = [];
  const errors: { row: number; error: string }[] = [];

  rows.forEach((row: unknown, index: number) => {
    const parsed = playerSchema.safeParse(row);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      const message =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
        "Invalid row";
      errors.push({ row: index + 1, error: message });
    }
  });

  await connectDB();
  const created =
    valid.length > 0
      ? await PlayerModel.insertMany(valid, { ordered: false })
      : [];

  return NextResponse.json({ created: created.length, errors });
}
