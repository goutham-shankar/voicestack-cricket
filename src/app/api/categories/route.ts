import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { categorySchema } from "@/lib/validators/category";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { PlayerCategories } from "@/models/PlayerCategory";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const categories = await PlayerCategories.find(undefined, {
    sort: { order: 1, name: 1 },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await PlayerCategories.create(parsed.data);
    return NextResponse.json(category, { status: 201 });
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
