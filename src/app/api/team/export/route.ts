import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { Players } from "@/models/Player";
import { populatePlayers } from "@/lib/services/populate";
import { getUserTeam, getUserTeamId } from "@/lib/session-team";
import { getLedgerSummary, getTeamLedger } from "@/lib/services/wallet-ledger";
import { getSingleton } from "@/lib/db";
import { AuctionSettingsStore } from "@/models/AuctionSettings";

/** RFC 4180 field escaping — quote anything containing a comma, quote or newline. */
function cell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (values: unknown[]) => values.map(cell).join(",");

/** Spreadsheet-safe file stem: "Adith & Nivya" -> "adith-nivya". */
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "team"
  );
}

/**
 * The signed-in team's own sheet: every player it has signed, then its purse.
 *
 * The team is read from the session, never from the request, so this cannot be
 * pointed at another franchise's data. Admins have the whole-auction export at
 * /api/auction/export instead.
 */
export async function GET() {
  const { session, response: unauthorized } = await requireRole(["team"]);
  if (unauthorized) return unauthorized;

  const team = await getUserTeam(session.user.id);
  const teamId = await getUserTeamId(session.user.id);
  if (!team || !teamId) {
    return NextResponse.json({ error: "No team assigned" }, { status: 404 });
  }

  const [players, summary, ledger, settings] = await Promise.all([
    populatePlayers(
      await Players.find(
        { soldToTeamId: teamId, status: "SOLD" },
        { sort: { updatedAt: 1 } }
      )
    ),
    getLedgerSummary(teamId),
    getTeamLedger(teamId),
    getSingleton(AuctionSettingsStore),
  ]);

  const minSquad = settings.minSquadSize ?? 20;
  // A team whose ledger has not been backfilled has no entries at all, and the
  // summary then reports a remaining balance of 0. Fall back to the budget
  // minus spend, the same way the auction board does, so the purse never reads
  // as empty just because the ledger is missing.
  const remaining = summary.hasLedger
    ? summary.remaining
    : team.initialBudget - summary.spent;

  const lines: string[] = [
    row(["Team", team.name]),
    row(["Exported", new Date().toISOString()]),
    "",
    row(["#", "Player", "Role", "Category", "Price"]),
    ...players.map((player, i) =>
      row([
        i + 1,
        player.name,
        player.role,
        player.categoryId?.name ?? "",
        player.soldPrice ?? 0,
      ])
    ),
    "",
    row(["Summary", "Value"]),
    row(["Players signed", players.length]),
    row(["Minimum squad", minSquad]),
    row(["Still needed", Math.max(0, minSquad - players.length)]),
    row(["Starting budget", team.initialBudget]),
    row(["Spent", summary.spent]),
    row(["Purse remaining", remaining]),
  ];

  if (ledger.length) {
    lines.push(
      "",
      row(["Transaction", "Type", "Amount", "Balance after"]),
      ...ledger.map((txn) =>
        row([txn.note, txn.type, txn.amount, txn.balanceAfter])
      )
    );
  }

  // Excel opens UTF-8 correctly only when the file carries a BOM.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(team.name)}-squad-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
