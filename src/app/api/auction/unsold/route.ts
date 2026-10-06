import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { markUnsold } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

export async function POST() {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { state, result } = await markUnsold();
    await broadcastAuction("auction:unsold", result);
    await broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
