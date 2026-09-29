"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/players/status-badge";
import { History as HistoryIcon, ListOrdered } from "lucide-react";

type TeamRef = { _id: string; name: string; logoUrl: string | null } | null;
type CategoryRef = { _id: string; name: string; defaultBasePrice: number } | null;

type PlayerRow = {
  _id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  categoryId: CategoryRef;
  basePriceOverride: number | null;
  status: "SOLD" | "UNSOLD";
  soldToTeamId: TeamRef;
  soldPrice: number | null;
};

type BidRow = {
  _id: string;
  amount: number;
  createdAt: string;
  teamId: TeamRef;
};

export function HistoryTable({
  rows,
}: {
  rows: { player: PlayerRow; bids: BidRow[] }[];
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const openRow = rows.find((r) => r.player._id === openFor);

  return (
    <Card>
      <CardContent className="pt-6">
        {rows.length === 0 ? (
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
                <TableHead>Base Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sold For</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Bids</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ player, bids }) => {
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
                    <TableCell className="tabular-money">
                      ₹{basePrice.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={player.status} />
                    </TableCell>
                    <TableCell className="tabular-money font-medium text-primary">
                      {player.soldPrice != null
                        ? `₹${player.soldPrice.toLocaleString("en-IN")}`
                        : "—"}
                    </TableCell>
                    <TableCell>{player.soldToTeamId?.name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{bids.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={bids.length === 0}
                        onClick={() => setOpenFor(player._id)}
                      >
                        <ListOrdered className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={Boolean(openRow)} onOpenChange={(next) => !next && setOpenFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openRow?.player.name} — Bid History</DialogTitle>
            <DialogDescription>
              Every bid placed for this player, most recent first.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {openRow?.bids.map((bid, i) => (
              <div
                key={bid._id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={
                  i === 0
                    ? {
                        backgroundColor:
                          "color-mix(in oklch, var(--primary) 12%, transparent)",
                      }
                    : undefined
                }
              >
                <span className="font-medium">
                  {bid.teamId?.name ?? "Unknown team"}
                </span>
                <span className="tabular-money font-semibold text-primary">
                  ₹{bid.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
