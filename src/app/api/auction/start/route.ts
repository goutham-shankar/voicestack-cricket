import { NextRequest, NextResponse } from "next/server";
import { requireAuctionControl } from "@/lib/api-auth";
import { startAuction } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAuctionControl();
  if (unauthorized) return unauthorized;

  const { playerId } = await req.json();
  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    const state = await startAuction(playerId);
    await broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
