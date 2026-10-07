import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getFullState, scopeWalletsForViewer } from "@/lib/services/auction-service";

export async function GET() {
  const { session, response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  // A pure read. Clients poll this route when sockets are unavailable, so it
  // must never mutate the auction — a lot is only ever closed by an admin
  // calling /api/auction/sell or /api/auction/unsold.
  const state = await getFullState();
  return NextResponse.json(
    scopeWalletsForViewer(state, {
      role: session.user.role,
      teamId: session.user.teamId ?? null,
    })
  );
}
