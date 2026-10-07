import { fmt } from "@/lib/auction-engine";
import { auth } from "@/auth";
import { Players } from "@/models/Player";
import { populatePlayers } from "@/lib/services/populate";
import { getUserTeam, getUserTeamId } from "@/lib/session-team";
import { getLedgerSummary } from "@/lib/services/wallet-ledger";
import { getSingleton } from "@/lib/db";
import { AuctionSettingsStore } from "@/models/AuctionSettings";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users2, Download } from "lucide-react";

/**
 * Everything a franchise needs about itself, on one page: what is left to
 * spend, how close the squad is to its minimum, and who has been signed.
 *
 * This replaces the separate dashboard, wallet and squad pages. They showed
 * eleven stat cards between them and each one cost its own navigation, which
 * is a lot of machinery for three numbers and a list.
 */
export default async function TeamDashboardPage() {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id);
  const teamId = await getUserTeamId(session?.user?.id);

  if (!team || !teamId) {
    return (
      <div className="mx-auto w-full max-w-4xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Your login is not linked to a team. Ask an admin to assign your
          franchise.
        </p>
      </div>
    );
  }

  // Read the settings document on its own rather than through getFullState():
  // the full board snapshot is ~112 document reads, and this page wants one
  // number off it.
  const [players, summary, settings] = await Promise.all([
    populatePlayers(
      await Players.find(
        { soldToTeamId: teamId, status: "SOLD" },
        { sort: { updatedAt: -1 } }
      )
    ),
    getLedgerSummary(teamId),
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
  const stillNeeded = Math.max(0, minSquad - players.length);
  const budget = team.initialBudget;
  const spentPct = budget ? Math.min(100, (summary.spent / budget) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      {/* Purse — the one number that matters mid-auction. */}
      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Purse remaining
        </p>
        <p className="text-5xl font-bold tabular-money text-primary">
          {fmt(remaining)}
        </p>
        <Progress value={spentPct} />
        <div className="flex justify-between text-xs text-muted-foreground tabular-money">
          <span>Spent {fmt(summary.spent)}</span>
          <span>Budget {fmt(budget)}</span>
        </div>
      </section>

      {/* Squad progress against the minimum — there is no maximum. */}
      <section className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-border bg-card p-4">
        <span className="text-2xl font-semibold tabular-nums">
          {players.length}
        </span>
        <span className="text-sm text-muted-foreground">
          {players.length === 1 ? "player signed" : "players signed"}
        </span>
        <span className="ml-auto text-sm text-muted-foreground">
          {stillNeeded > 0
            ? `${stillNeeded} more to reach the minimum of ${minSquad}`
            : `Minimum of ${minSquad} reached — you can keep signing`}
        </span>
      </section>

      {/* Squad list. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Your squad</h2>
          {/* A plain link, not a fetch: the browser handles the download and
              the route names the file. */}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href="/api/team/export" download />}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>

        {players.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
            <Users2 className="size-7" />
            <p className="text-sm">No players yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {players.map((player) => (
              <li key={player._id} className="flex items-center gap-3 p-3">
                <Avatar className="size-10">
                  {player.avatarUrl && (
                    <AvatarImage
                      src={player.avatarUrl}
                      alt=""
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-xs">
                    {player.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{player.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[player.role, player.categoryId?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-money">
                  {fmt(player.soldPrice ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
