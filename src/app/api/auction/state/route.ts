import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getFullState, resolveExpiredLot } from "@/lib/services/auction-service";
import { broadcastAuction } from "@/lib/socket-server";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  // Clients poll this route when sockets are unavailable, so several of them
  // can hit an expired lot at the same moment. Exactly one wins the race inside
  // resolveExpiredLot; the losers throw ("no player is currently live") and
  // should simply read back the state the winner just wrote.
  try {
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
  } catch {
    // fall through to a plain read below
  }

  const state = await getFullState({ resolveExpired: false });
  return NextResponse.json(state);
}
