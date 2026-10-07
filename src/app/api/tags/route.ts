import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { tagSchema } from "@/lib/validators/tag";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { PlayerTags } from "@/models/PlayerTag";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const tags = await PlayerTags.find(undefined, { sort: { name: 1 } });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const tag = await PlayerTags.create(parsed.data);
    return NextResponse.json(tag, { status: 201 });
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
