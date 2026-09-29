import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { teamSchema } from "@/lib/validators/team";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import TeamModel from "@/models/Team";
import UserModel from "@/models/User";
import { recordTransaction } from "@/lib/services/wallet-ledger";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  await connectDB();
  const teams = await TeamModel.find().sort({ name: 1 }).lean();
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = teamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { loginEmail, loginPassword, ...teamData } = parsed.data;

  if (loginEmail && !loginPassword) {
    return NextResponse.json(
      { error: { fieldErrors: { loginPassword: ["Password is required to create a login"] } } },
      { status: 400 }
    );
  }

  await connectDB();
  try {
    const team = await TeamModel.create(teamData);

    await recordTransaction({
      teamId: String(team._id),
      type: "CREDIT",
      amount: team.initialBudget,
      note: "Starting balance",
    });

    if (loginEmail && loginPassword) {
      const existingUser = await UserModel.findOne({ email: loginEmail });
      if (existingUser) {
        await TeamModel.findByIdAndDelete(team._id);
        return NextResponse.json(
          { error: { fieldErrors: { loginEmail: ["Email is already in use"] } } },
          { status: 409 }
        );
      }
      const passwordHash = await bcrypt.hash(loginPassword, 10);
      await UserModel.create({
        email: loginEmail,
        passwordHash,
        role: "team",
        name: team.name,
        teamId: team._id,
      });
    }

    return NextResponse.json(team, { status: 201 });
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
