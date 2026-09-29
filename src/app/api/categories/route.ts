import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { categorySchema } from "@/lib/validators/category";
import { isDuplicateKeyError } from "@/lib/mongo-errors";
import PlayerCategoryModel from "@/models/PlayerCategory";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  await connectDB();
  const categories = await PlayerCategoryModel.find().sort({ order: 1, name: 1 }).lean();
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

  await connectDB();
  try {
    const category = await PlayerCategoryModel.create(parsed.data);
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
