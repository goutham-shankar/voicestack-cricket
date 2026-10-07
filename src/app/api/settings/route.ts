import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { settingsSchema } from "@/lib/validators/settings";
import { getSingleton } from "@/lib/db";
import { AuctionSettingsStore } from "@/models/AuctionSettings";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json(await getSingleton(AuctionSettingsStore));
}

export async function PATCH(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  // Validate the merged document so cross-field rules also hold for PATCHes
  // that only change one side of a constraint.
  const current = await getSingleton(AuctionSettingsStore);
  const parsed = settingsSchema.safeParse({ ...current, ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await AuctionSettingsStore.updateById("global", parsed.data);
  return NextResponse.json(settings);
}
