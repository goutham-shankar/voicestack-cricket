import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { tagSchema } from "@/lib/validators/tag";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { PlayerTags } from "@/models/PlayerTag";
import { Players } from "@/models/Player";

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

  try {
    const tag = await PlayerTags.updateById(id, parsed.data);
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

  // Drop the tag from every player carrying it before removing the tag itself.
  await Players.updateMany(
    { tagIds: { $contains: id } },
    { $pull: { tagIds: id } }
  );

  const deleted = await PlayerTags.deleteById(id);
  if (!deleted) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
