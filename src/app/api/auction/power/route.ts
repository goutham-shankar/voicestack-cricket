import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  clearPowerPick,
  endPowerRound,
  resolvePowerRound,
  revealPowerPicks,
  setPowerPick,
  startPowerRound,
} from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

/**
 * Every step of the final power-player round, keyed by `action`.
 *
 * One route rather than six: these are all moves in a single round that only
 * the admin makes, and they share the same guard, broadcast and error
 * handling. Splitting them would be five more files saying the same thing.
 */
export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  try {
    switch (action) {
      case "start":
        return NextResponse.json(await broadcast(await startPowerRound()));

      case "end":
        return NextResponse.json(await broadcast(await endPowerRound()));

      case "reveal":
        return NextResponse.json(
          await broadcast(await revealPowerPicks(body.revealed !== false))
        );

      case "pick": {
        const teamId = typeof body.teamId === "string" ? body.teamId : null;
        const playerId = typeof body.playerId === "string" ? body.playerId : null;
        const amount = typeof body.amount === "number" ? body.amount : null;
        if (!teamId || !playerId || amount == null) {
          return NextResponse.json(
            { error: "teamId, playerId and amount are required" },
            { status: 400 }
          );
        }
        return NextResponse.json(
          await broadcast(await setPowerPick(teamId, playerId, amount))
        );
      }

      case "clear": {
        const teamId = typeof body.teamId === "string" ? body.teamId : null;
        if (!teamId) {
          return NextResponse.json({ error: "teamId is required" }, { status: 400 });
        }
        return NextResponse.json(await broadcast(await clearPowerPick(teamId)));
      }

      case "resolve": {
        const { state, awarded } = await resolvePowerRound();
        await broadcast(state);
        return NextResponse.json({ ...state, awarded });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action "${action}"` },
          { status: 400 }
        );
    }
  } catch (err) {
    return handleServiceError(err);
  }
}

async function broadcast<T>(state: T): Promise<T> {
  await broadcastAuction("auction:state", state);
  return state;
}
