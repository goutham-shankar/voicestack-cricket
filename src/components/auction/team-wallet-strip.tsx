import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TeamSummary } from "@/lib/auction-types";

/**
 * Who is in the room and how much room they have left in their squad.
 *
 * Deliberately no purse figure: the admin reads those from the purse table on
 * the board, and a franchise reads its own from its team panel. Rivals'
 * balances are not part of this strip.
 */
export function TeamWalletStrip({ teams }: { teams: TeamSummary[] }) {
  if (teams.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No teams yet.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {teams.map((team) => {
        const slots = team.slotsRemaining;
        const isFull = slots != null && slots <= 0;
        return (
          <div
            key={team._id}
            className="flex min-w-44 shrink-0 items-center gap-2.5 rounded-xl border border-border p-3"
          >
            <Avatar className="rounded-lg">
              {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
              <AvatarFallback className="rounded-lg bg-secondary text-xs">
                {team.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{team.name}</p>
              <p
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  isFull ? "text-unsold-foreground" : "text-muted-foreground"
                )}
              >
                {isFull
                  ? "Squad full"
                  : slots == null
                    ? `${team.squadCount} signed`
                    : `${slots} slots left`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
