"use client";

import { fmt } from "@/lib/auction-engine";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Circle, WifiOff, Tv, AlertTriangle } from "lucide-react";
import { useAuctionState } from "@/lib/use-auction-state";
import { PlayerSpotlight } from "@/components/auction/player-spotlight";
import { RecentSalesList } from "@/components/auction/recent-sales-list";
import { TeamWalletStrip } from "@/components/auction/team-wallet-strip";
import { MySquadList, MyTeamPanel } from "@/components/auction/my-team-panel";
import { StatsBar } from "@/components/auction/stats-bar";
import { ControlPanel } from "@/components/auction/control-panel";

export function AuctionRoom({
  role,
  myTeam,
}: {
  role: "admin" | "auctioneer" | "team";
  myTeam?: { _id: string; name: string } | null;
}) {
  // Only admin runs the room — start the lot / record the offline sale result.
  // Auctioneer and team accounts are read-only: bidding happens verbally, offline.
  const canControl = role === "admin";
  const canSell = role === "admin";
  const showControls = canControl || canSell;
  /**
   * Everyone in the room sees the same board — the live lot, the running
   * stats and every team's purse. An auction is public by nature: a team
   * cannot bid sensibly without knowing what its rivals can still spend.
   * Only the controls are privileged.
   *
   * A franchise login additionally gets its own team and squad called out.
   */
  const ownTeamView = myTeam != null;
  const showRecentSales = role !== "auctioneer";
  const [squadRefreshKey, setSquadRefreshKey] = useState(0);

  const { state, connected } = useAuctionState({
    onSold: (result) => {
      toast.success(`${result.playerName} SOLD to ${result.teamName}`, {
        description: `${fmt(result.price)}`,
      });
      if (myTeam) setSquadRefreshKey((k) => k + 1);
    },
    onUnsold: (result) => toast(`${result.playerName} went UNSOLD`),
  });

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading auction state…
      </div>
    );
  }

  if (role === "team" && !myTeam) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>No team assigned</AlertTitle>
        <AlertDescription>
          Your login is not linked to a team. Ask an admin to assign your franchise.
        </AlertDescription>
      </Alert>
    );
  }

  const viewState = state;

  const isLive = viewState.auctionState.status === "LIVE";
  const myTeamSummary = myTeam
    ? viewState.teams.find((t) => String(t._id) === String(myTeam._id)) ?? null
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatsBar stats={viewState.stats} />
        <div className="ml-auto flex items-center gap-2">
          {!connected && (
            <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
              <WifiOff className="size-3" />
              Reconnecting
            </Badge>
          )}
          <Badge
            className={
              isLive
                ? "gap-1.5 border-0 bg-live/15 text-live"
                : "gap-1.5 border-0 bg-muted text-muted-foreground"
            }
          >
            <Circle className={isLive ? "size-2 animate-pulse fill-current" : "size-2 fill-current"} />
            {isLive ? "LIVE" : "Auction Idle"}
          </Badge>
          {role === "admin" && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/display" target="_blank" />}
            >
              <Tv className="size-3.5" />
              Open Display
            </Button>
          )}
        </div>
      </div>

      {ownTeamView && myTeamSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Team</CardTitle>
          </CardHeader>
          <CardContent>
            <MyTeamPanel team={myTeamSummary} />
          </CardContent>
        </Card>
      )}

      <div
        className={
          showRecentSales
            ? "grid grid-cols-1 gap-5 lg:grid-cols-3"
            : "grid grid-cols-1 gap-5"
        }
      >
        <Card className={showRecentSales ? "lg:col-span-2" : undefined}>
          <CardContent className="pt-6">
            <PlayerSpotlight player={viewState.auctionState.currentPlayerId} />
            {isLive && (
              <div className="mt-4 flex justify-center">
              </div>
            )}
            {isLive && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Bidding happens verbally in the room.
                {canSell ? " Record the result below once it's sold." : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {showRecentSales && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentSalesList sales={viewState.recentSales} />
            </CardContent>
          </Card>
        )}
      </div>

      {showControls && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auction Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <ControlPanel state={viewState} canControl={canControl} canSell={canSell} />
          </CardContent>
        </Card>
      )}

      {ownTeamView && myTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Squad</CardTitle>
          </CardHeader>
          <CardContent>
            <MySquadList teamId={myTeam._id} refreshKey={squadRefreshKey} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamWalletStrip teams={viewState.teams} />
        </CardContent>
      </Card>
    </div>
  );
}
