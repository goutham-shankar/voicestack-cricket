import { NextRequest, NextResponse } from "next/server";
import { requireBidder } from "@/lib/api-auth";
import { placeBid } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";
import { getUserTeamId } from "@/lib/session-team";

export async function POST(req: NextRequest) {
  const { session, response: unauthorized } = await requireBidder();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const teamId = typeof body.teamId === "string" ? body.teamId : null;
  const amount = body.amount;

  if (!teamId || typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json(
      { error: "teamId and a finite numeric amount are required" },
      { status: 400 }
    );
  }

  const linkedTeamId = await getUserTeamId(session.user.id);
  if (!linkedTeamId || linkedTeamId !== teamId) {
    return NextResponse.json(
      { error: "You can only bid on behalf of your own team" },
      { status: 403 }
    );
  }

  try {
    const state = await placeBid(teamId, amount);
    broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
