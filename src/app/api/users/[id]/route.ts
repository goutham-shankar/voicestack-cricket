import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { staffUserUpdateSchema } from "@/lib/validators/user";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import UserModel from "@/models/User";
import "@/models/Team";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = staffUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();

  const existing = await UserModel.findOne({
    _id: id,
    role: { $in: ["admin", "auctioneer"] },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Don't let an admin demote/change their own role and lock themselves out.
  if (id === session.user.id && parsed.data.role !== existing.role) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }

  const updates: {
    name: string;
    email: string;
    role: "admin" | "auctioneer";
    teamId: string | null;
    passwordHash?: string;
  } = {
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    teamId: parsed.data.role === "auctioneer" ? (parsed.data.teamId || null) : null,
  };

  if (parsed.data.password) {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  try {
    const user = await UserModel.findByIdAndUpdate(id, updates, {
      returnDocument: "after",
    })
      .select("name email role teamId")
      .populate("teamId");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  await connectDB();
  const deleted = await UserModel.findOneAndDelete({
    _id: id,
    role: { $in: ["admin", "auctioneer"] },
  });
  if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
