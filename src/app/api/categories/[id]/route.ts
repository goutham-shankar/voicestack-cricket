import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { categorySchema } from "@/lib/validators/category";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import PlayerCategoryModel from "@/models/PlayerCategory";
import PlayerModel from "@/models/Player";

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

  await connectDB();
  try {
    const category = await PlayerCategoryModel.findByIdAndUpdate(id, parsed.data, {
      returnDocument: "after",
    });
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
  await connectDB();

  const inUse = await PlayerModel.exists({ categoryId: id });
  if (inUse) {
    return NextResponse.json(
      { error: "Category is assigned to one or more players" },
      { status: 409 }
    );
  }

  const deleted = await PlayerCategoryModel.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
