"use client";

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
import { BidPanel } from "@/components/auction/bid-panel";
import { BidHistoryList } from "@/components/auction/bid-history-list";
import { AuctionTimer } from "@/components/auction/auction-timer";
import { TeamWalletStrip } from "@/components/auction/team-wallet-strip";
import { MySquadList, MyTeamPanel } from "@/components/auction/my-team-panel";
import { StatsBar } from "@/components/auction/stats-bar";
import { ControlPanel } from "@/components/auction/control-panel";
import type { FullAuctionState } from "@/lib/auction-types";

function scopeStateToTeam(
  state: FullAuctionState,
  teamId: string
): FullAuctionState {
  // Keep real team names in bid history / leading team — only hide other wallets.
  return {
    ...state,
    teams: state.teams.filter((t) => String(t._id) === String(teamId)),
    // Franchise users don't need the pending queue — admin starts lots.
    pendingPlayers: [],
  };
}

export function AuctionRoom({
  role,
  myTeam,
}: {
  role: "admin" | "auctioneer" | "team";
  myTeam?: { _id: string; name: string } | null;
}) {
  // Only admin runs the room (start / timer / sell). Auctioneers bid for one team.
  const canControl = role === "admin";
  const canBid = role === "auctioneer" || role === "team";
  const canSell = role === "admin";
  const showControls = canControl || canBid || canSell;
  const franchiseView = role === "auctioneer" || role === "team";
  const [squadRefreshKey, setSquadRefreshKey] = useState(0);

  const { state, connected } = useAuctionState({
    onSold: (result) => {
      toast.success(`${result.playerName} SOLD to ${result.teamName}`, {
        description: `₹${result.price.toLocaleString("en-IN")}`,
      });
      if (franchiseView) setSquadRefreshKey((k) => k + 1);
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

  if (franchiseView && !myTeam) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>No team assigned</AlertTitle>
        <AlertDescription>
          Your login is not linked to a team. Ask an admin to assign your franchise
          before you can bid.
        </AlertDescription>
      </Alert>
    );
  }

  const viewState =
    franchiseView && myTeam ? scopeStateToTeam(state, myTeam._id) : state;

  const isLive = viewState.auctionState.status === "LIVE";
  const myTeamSummary = myTeam
    ? viewState.teams.find((t) => String(t._id) === String(myTeam._id)) ?? null
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!franchiseView && <StatsBar stats={viewState.stats} />}
        {franchiseView && myTeamSummary && (
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{myTeamSummary.name}</span>
            <span>·</span>
            <span className="tabular-money">
              Wallet ₹{myTeamSummary.remaining.toLocaleString("en-IN")}
            </span>
            {isLive &&
              viewState.auctionState.currentBidTeamId &&
              String(viewState.auctionState.currentBidTeamId._id) ===
                String(myTeamSummary._id) && (
                <>
                  <span>·</span>
                  <span className="tabular-money text-live">
                    In bid ₹{viewState.auctionState.currentBid.toLocaleString("en-IN")}
                  </span>
                  <span>·</span>
                  <span className="tabular-money text-sold">
                    Free ₹
                    {Math.max(
                      0,
                      myTeamSummary.remaining - viewState.auctionState.currentBid
                    ).toLocaleString("en-IN")}
                  </span>
                </>
              )}
            <span>·</span>
            <span>
              Squad {myTeamSummary.squadCount}/{myTeamSummary.maxSquadSize}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
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

      {franchiseView && myTeamSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Team</CardTitle>
          </CardHeader>
          <CardContent>
            <MyTeamPanel
              team={myTeamSummary}
              leadingTeamId={viewState.auctionState.currentBidTeamId?._id}
              currentBid={isLive ? viewState.auctionState.currentBid : 0}
              minReservePerSlot={viewState.settings?.minReservePerSlot ?? 0}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <PlayerSpotlight player={viewState.auctionState.currentPlayerId} />
            {isLive && (
              <div className="mt-4 flex justify-center">
                <AuctionTimer auctionState={viewState.auctionState} />
              </div>
            )}
            {isLive && (
              <div className="mt-6">
                <BidPanel
                  auctionState={viewState.auctionState}
                  bidHistory={viewState.bidHistory}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bid History</CardTitle>
          </CardHeader>
          <CardContent>
            <BidHistoryList bids={viewState.bidHistory} />
          </CardContent>
        </Card>
      </div>

      {showControls && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canBid && !canControl && !canSell ? "Place a Bid" : "Auction Controls"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ControlPanel
              state={viewState}
              canControl={canControl}
              canBid={canBid}
              canSell={canSell}
              myTeam={myTeam}
            />
          </CardContent>
        </Card>
      )}

      {franchiseView && myTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Squad</CardTitle>
          </CardHeader>
          <CardContent>
            <MySquadList teamId={myTeam._id} refreshKey={squadRefreshKey} />
          </CardContent>
        </Card>
      )}

      {!franchiseView && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamWalletStrip
              teams={viewState.teams}
              leadingTeamId={viewState.auctionState.currentBidTeamId?._id}
              currentBid={isLive ? viewState.auctionState.currentBid : 0}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
