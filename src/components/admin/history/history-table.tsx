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
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/players/status-badge";
import { History as HistoryIcon } from "lucide-react";

type TeamRef = { _id: string; name: string; logoUrl: string | null } | null;
type CategoryRef = { _id: string; name: string; defaultBasePrice: number } | null;

type PlayerRow = {
  _id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  gender: "M" | "F" | null;
  categoryId: CategoryRef;
  basePriceOverride: number | null;
  status: "SOLD" | "UNSOLD";
  soldToTeamId: TeamRef;
  soldPrice: number | null;
};

export function HistoryTable({ players }: { players: PlayerRow[] }) {
  return (
    <Card>
      <CardContent className="pt-6">
        {players.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <HistoryIcon className="size-8" />
            <p className="text-sm">
              No players have gone through the auction yet.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sold For</TableHead>
                <TableHead>Team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => {
                const basePrice =
                  player.basePriceOverride ?? player.categoryId?.defaultBasePrice ?? 0;
                return (
                  <TableRow key={player._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="rounded-lg">
                          {player.avatarUrl && (
                            <AvatarImage src={player.avatarUrl} alt="" />
                          )}
                          <AvatarFallback className="rounded-lg bg-secondary">
                            {player.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {player.gender === "M"
                        ? "Male"
                        : player.gender === "F"
                          ? "Female"
                          : "—"}
                    </TableCell>
                    <TableCell className="tabular-money">
                      {fmt(basePrice)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={player.status} />
                    </TableCell>
                    <TableCell className="tabular-money font-medium text-primary">
                      {player.soldPrice != null
                        ? `${fmt(player.soldPrice)}`
                        : "—"}
                    </TableCell>
                    <TableCell>{player.soldToTeamId?.name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
