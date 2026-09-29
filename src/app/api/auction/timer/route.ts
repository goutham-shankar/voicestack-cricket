import { NextRequest, NextResponse } from "next/server";
import { requireAuctionControl } from "@/lib/api-auth";
import { setTimerEnabled } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

export async function PATCH(req: NextRequest) {
  const { response: unauthorized } = await requireAuctionControl();
  if (unauthorized) return unauthorized;

  const { enabled } = await req.json();
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  try {
    const state = await setTimerEnabled(enabled);
    broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
