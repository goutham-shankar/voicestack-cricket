import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/api-auth";
import { staffUserSchema } from "@/lib/validators/user";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { Users } from "@/models/User";
import { listStaffUsers } from "@/lib/services/staff-users";

export async function GET() {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  return NextResponse.json(await listStaffUsers());
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = staffUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await Users.create({
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
      teamId: parsed.data.role === "auctioneer" ? (parsed.data.teamId ?? null) : null,
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
