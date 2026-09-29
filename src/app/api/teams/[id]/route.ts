import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { getTeamFinancials } from "@/lib/services/auction-service";
import { recordTransaction } from "@/lib/services/wallet-ledger";
import { teamSchema } from "@/lib/validators/team";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import TeamModel from "@/models/Team";
import UserModel from "@/models/User";
import PlayerModel from "@/models/Player";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await connectDB();
  const team = await TeamModel.findById(id).lean();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  return NextResponse.json(team);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = teamSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Login fields belong on User, not Team.
  const teamPatch: Record<string, unknown> = {};
  for (const key of ["name", "logoUrl", "initialBudget", "maxSquadSize"] as const) {
    if (key in parsed.data) teamPatch[key] = parsed.data[key];
  }

  await connectDB();

  const existing = await TeamModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (teamPatch.initialBudget != null || teamPatch.maxSquadSize != null) {
    const { spent, squadCount } = await getTeamFinancials(id);
    const nextBudget = teamPatch.initialBudget ?? existing.initialBudget;
    const nextMaxSquad = teamPatch.maxSquadSize ?? existing.maxSquadSize;
    if (nextBudget < spent) {
      return NextResponse.json(
        {
          error: `Budget cannot be below current spend (₹${spent.toLocaleString("en-IN")})`,
        },
        { status: 400 }
      );
    }
    if (nextMaxSquad < squadCount) {
      return NextResponse.json(
        {
          error: `Max squad size cannot be below current squad (${squadCount})`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const team = await TeamModel.findByIdAndUpdate(id, teamPatch, {
      returnDocument: "after",
    });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    if (
      typeof teamPatch.initialBudget === "number" &&
      teamPatch.initialBudget !== existing.initialBudget
    ) {
      const delta = teamPatch.initialBudget - existing.initialBudget;
      await recordTransaction({
        teamId: id,
        type: "ADJUSTMENT",
        amount: delta,
        note: `Budget adjusted by admin (₹${existing.initialBudget.toLocaleString("en-IN")} → ₹${teamPatch.initialBudget.toLocaleString("en-IN")})`,
      });
    }

    return NextResponse.json(team);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A team with this name already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await connectDB();

  const [hasUser, hasPlayers] = await Promise.all([
    UserModel.exists({ teamId: id }),
    PlayerModel.exists({ soldToTeamId: id }),
  ]);

  if (hasUser || hasPlayers) {
    return NextResponse.json(
      { error: "Team has a linked login or squad history and cannot be deleted" },
      { status: 409 }
    );
  }

  const deleted = await TeamModel.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
