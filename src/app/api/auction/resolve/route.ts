import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getFullState, resolveExpiredLot } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

/** Close a lot whose timer has expired (auto-sell or unsold). */
export async function POST() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const resolved = await resolveExpiredLot();
    if (!resolved) {
      const state = await getFullState({ resolveExpired: false });
      return NextResponse.json(state);
    }

    if (resolved.result.status === "SOLD") {
      broadcastAuction("auction:sold", resolved.result);
    } else {
      broadcastAuction("auction:unsold", resolved.result);
    }
    broadcastAuction("auction:state", resolved.state);
    return NextResponse.json(resolved.state);
  } catch (err) {
    return handleServiceError(err);
  }
}
