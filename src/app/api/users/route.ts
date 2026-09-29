import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { staffUserSchema } from "@/lib/validators/user";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import UserModel from "@/models/User";
import "@/models/Team";

export async function GET() {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  await connectDB();
  const users = await UserModel.find({ role: { $in: ["admin", "auctioneer"] } })
    .select("name email role teamId createdAt")
    .populate("teamId")
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = staffUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await UserModel.create({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
      teamId: parsed.data.role === "auctioneer" ? parsed.data.teamId : null,
    });
    return NextResponse.json(
      { _id: user._id, name: user.name, email: user.email, role: user.role },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
