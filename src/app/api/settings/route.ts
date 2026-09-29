import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { settingsSchema } from "@/lib/validators/settings";
import AuctionSettingsModel from "@/models/AuctionSettings";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  await connectDB();
  const settings = await AuctionSettingsModel.findOneAndUpdate(
    { singleton: "global" },
    { $setOnInsert: { singleton: "global" } },
    { upsert: true, returnDocument: "after" }
  );
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = settingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const settings = await AuctionSettingsModel.findOneAndUpdate(
    { singleton: "global" },
    { $set: parsed.data, $setOnInsert: { singleton: "global" } },
    { upsert: true, returnDocument: "after" }
  );
  return NextResponse.json(settings);
}
