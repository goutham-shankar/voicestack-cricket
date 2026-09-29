import { requireAuctionControl } from "@/lib/api-auth";
import { pauseTimer } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";
import { NextResponse } from "next/server";

export async function POST() {
  const { response: unauthorized } = await requireAuctionControl();
  if (unauthorized) return unauthorized;

  try {
    const state = await pauseTimer();
    broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
