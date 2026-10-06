import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { categorySchema } from "@/lib/validators/category";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { PlayerCategories } from "@/models/PlayerCategory";
import { Players } from "@/models/Player";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = categorySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await PlayerCategories.updateById(id, parsed.data);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
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

  const inUse = await Players.exists({ categoryId: id });
  if (inUse) {
    return NextResponse.json(
      { error: "Category is assigned to one or more players" },
      { status: 409 }
    );
  }

  const deleted = await PlayerCategories.deleteById(id);
  if (!deleted) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
