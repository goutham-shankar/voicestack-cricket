import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { Players } from "@/models/Player";
import { populatePlayersWithTeam } from "@/lib/services/populate";

/** RFC 4180 field escaping — quote anything containing a comma, quote or newline. */
function cell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "#",
  "Player",
  "Role",
  "Gender",
  "Category",
  "Status",
  "Team",
  "Sold Price",
  "Base Price",
] as const;

function genderLabel(gender: "M" | "F" | null) {
  if (gender === "M") return "Male";
  if (gender === "F") return "Female";
  return "";
}

export async function GET() {
  const { response: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  // Every player, grouped by category order then name, so the sheet reads in
  // the same order the lots were called.
  const players = await populatePlayersWithTeam(await Players.find());

  players.sort((a, b) => {
    const ao = a.categoryId?.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.categoryId?.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  const rows = players.map((p, i) => {
    const base = p.basePriceOverride ?? p.categoryId?.defaultBasePrice ?? 0;
    return [
      i + 1,
      p.name,
      p.role,
      genderLabel(p.gender),
      p.categoryId?.name ?? "",
      p.status,
      // Unsold and pending players have no buyer.
      p.status === "SOLD" ? (p.soldToTeamId?.name ?? "") : "",
      p.status === "SOLD" && p.soldPrice != null ? p.soldPrice : "",
      base,
    ].map(cell).join(",");
  });

  // Excel opens UTF-8 correctly only when the file carries a BOM.
  const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auction-results-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
