import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getUserTeamId } from "@/lib/session-team";
import { getTeamLedger } from "@/lib/services/wallet-ledger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response: unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  // Admins can view any team's ledger; franchise accounts only their own.
  if (session.user.role !== "admin") {
    const linkedTeamId = await getUserTeamId(session.user.id);
    if (linkedTeamId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await connectDB();
  const ledger = await getTeamLedger(id);
  return NextResponse.json(ledger);
}
