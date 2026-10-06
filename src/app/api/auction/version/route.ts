import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getStateVersion } from "@/lib/services/auction-service";

/**
 * The board's change signature, for clients polling without a socket. Costs a
 * single document read, against ~112 for the full state, so a room full of
 * screens can poll often without running up the Firestore bill.
 */
export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { version: await getStateVersion() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
