import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { tagSchema } from "@/lib/validators/tag";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import PlayerTagModel from "@/models/PlayerTag";
import PlayerModel from "@/models/Player";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = tagSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  try {
    const tag = await PlayerTagModel.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" });
    if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    return NextResponse.json(tag);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
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

  await PlayerModel.updateMany({ tagIds: id }, { $pull: { tagIds: id } });

  const deleted = await PlayerTagModel.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
