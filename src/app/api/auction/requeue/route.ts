import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { requeuePlayer } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const playerId = typeof body.playerId === "string" ? body.playerId : null;

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    const state = await requeuePlayer(playerId);
    broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
