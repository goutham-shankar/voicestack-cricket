import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/api-auth";
import { staffUserUpdateSchema } from "@/lib/validators/user";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { Users, type User } from "@/models/User";
import { toStaffUserDTOs } from "@/lib/services/staff-users";

/** Team logins are managed from the Teams page, so this route only sees staff. */
function isStaff(role: User["role"]) {
  return role === "admin" || role === "auctioneer";
}

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

  const existing = await Users.findById(id);
  if (!existing || !isStaff(existing.role)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Don't let an admin demote/change their own role and lock themselves out.
  if (id === session.user.id && parsed.data.role !== existing.role) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }

  const updates: Partial<User> = {
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    teamId: parsed.data.role === "auctioneer" ? (parsed.data.teamId || null) : null,
  };

  if (parsed.data.password) {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  try {
    const user = await Users.updateById(id, updates);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [dto] = await toStaffUserDTOs([user]);
    return NextResponse.json(dto);
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

  const user = await Users.findById(id);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await Users.deleteById(id);
  return NextResponse.json({ ok: true });
}
