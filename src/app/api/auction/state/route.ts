import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getFullState } from "@/lib/services/auction-service";

export async function GET() {
  const { response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json(await getFullState());
}
