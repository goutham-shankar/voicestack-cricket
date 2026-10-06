import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getStateVersion } from "@/lib/services/auction-service";

/**
 * The board's change signature, for clients polling without a socket. Costs a
 * single document read, against a full snapshot of every collection, so a room
 * full of screens can poll often without loading the database.
 */
export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { version: await getStateVersion() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
