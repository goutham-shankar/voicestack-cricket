import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { settingsSchema } from "@/lib/validators/settings";
import { getSingleton } from "@/lib/firestore";
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
  const parsed = settingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Creates the document from its defaults first, so a PATCH works on a fresh DB.
  await getSingleton(AuctionSettingsStore);
  const settings = await AuctionSettingsStore.updateById("global", parsed.data);
  return NextResponse.json(settings);
}
