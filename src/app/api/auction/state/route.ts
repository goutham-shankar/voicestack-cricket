import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getFullState, scopeWalletsForViewer } from "@/lib/services/auction-service";

export async function GET() {
  const { session, response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const state = await getFullState();
  return NextResponse.json(
    scopeWalletsForViewer(state, {
      role: session.user.role,
      teamId: session.user.teamId ?? null,
    })
  );
}
