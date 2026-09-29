import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getFullState, resolveExpiredLot } from "@/lib/services/auction-service";
import { broadcastAuction } from "@/lib/socket-server";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const resolved = await resolveExpiredLot();
  if (resolved) {
    if (resolved.result.status === "SOLD") {
      broadcastAuction("auction:sold", resolved.result);
    } else {
      broadcastAuction("auction:unsold", resolved.result);
    }
    broadcastAuction("auction:state", resolved.state);
    return NextResponse.json(resolved.state);
  }

  const state = await getFullState({ resolveExpired: false });
  return NextResponse.json(state);
}
