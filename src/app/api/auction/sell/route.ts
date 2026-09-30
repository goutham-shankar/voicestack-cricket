import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { sellPlayer } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const teamId = typeof body.teamId === "string" ? body.teamId : null;
  const price = typeof body.price === "number" ? body.price : null;

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }
  if (price == null) {
    return NextResponse.json({ error: "price is required" }, { status: 400 });
  }

  try {
    const { state, result } = await sellPlayer(teamId, price);
    broadcastAuction("auction:sold", result);
    broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
