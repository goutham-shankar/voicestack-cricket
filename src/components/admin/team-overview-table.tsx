import { fmt } from "@/lib/auction-engine";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TeamSummary } from "@/lib/auction-types";

export function TeamOverviewTable({ teams }: { teams: TeamSummary[] }) {
  if (teams.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No teams yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead>Players</TableHead>
          <TableHead>Spent</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Slots Left</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow key={team._id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="rounded-lg">
                  {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
                  <AvatarFallback className="rounded-lg bg-secondary text-xs">
                    {team.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{team.name}</span>
              </div>
            </TableCell>
            <TableCell className="tabular-nums">
              {team.squadCount}
              {team.maxSquadSize != null && `/${team.maxSquadSize}`}
            </TableCell>
            <TableCell className="tabular-money">
              {fmt(team.spent)}
            </TableCell>
            <TableCell className="tabular-money font-medium text-primary">
              {fmt(team.remaining)}
            </TableCell>
            <TableCell className="tabular-nums">{team.slotsRemaining}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
