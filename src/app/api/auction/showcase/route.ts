import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { setShowcase } from "@/lib/services/auction-service";
import { handleServiceError } from "@/lib/services/handle-service-error";
import { broadcastAuction } from "@/lib/socket-server";

export async function POST(req: NextRequest) {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const enabled = body.enabled !== false;

  try {
    const state = await setShowcase(enabled);
    broadcastAuction("auction:state", state);
    return NextResponse.json(state);
  } catch (err) {
    return handleServiceError(err);
  }
}
