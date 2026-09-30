import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireRole(roles: Array<"admin" | "auctioneer" | "team">) {
  const session = await auth();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  if (!roles.includes(session.user.role)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  return { session, response: null } as const;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}

/** Start / pause / resume / reset / timer — admin only. */
export async function requireAuctionControl() {
  return requireRole(["admin"]);
}

/** Any authenticated app user. */
export async function requireAuth() {
  return requireRole(["admin", "auctioneer", "team"]);
}
