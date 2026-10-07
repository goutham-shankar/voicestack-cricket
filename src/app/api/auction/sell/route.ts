import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { sellPlayer, sellToLeadingBid } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

/**
 * Hammers the current lot. With no body the sale goes to whoever holds the
 * standing bid, which is how the board's Sell button works. A `teamId` plus
 * `price` records a sale agreed off-system instead.
 */
export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const teamId = typeof body.teamId === "string" ? body.teamId : null;
  const price = typeof body.price === "number" ? body.price : null;

  if ((teamId == null) !== (price == null)) {
    return NextResponse.json(
      { error: "teamId and price must be given together" },
      { status: 400 }
    );
  }

  try {
    const { state, result } =
      teamId && price != null
        ? await sellPlayer(teamId, price)
        : await sellToLeadingBid();
    await broadcastAuction("auction:sold", result);
    await broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
