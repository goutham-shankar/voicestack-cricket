"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Play,
  Pause,
  RotateCcw,
  Gavel,
  Ban,
  Timer,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { FullAuctionState } from "@/lib/auction-types";

async function postJSON(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: url.includes("/timer") ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Action failed");
  }
  return data;
}

export function ControlPanel({
  state,
  canControl,
  canBid,
  canSell,
  myTeam,
}: {
  state: FullAuctionState;
  /** Start player, pause/resume/reset, toggle timer. */
  canControl: boolean;
  /** Place bids for myTeam. */
  canBid: boolean;
  /** Confirm sale or mark unsold. */
  canSell: boolean;
  myTeam?: { _id: string; name: string } | null;
}) {
  const { auctionState, pendingPlayers, settings } = state;
  const isLive = auctionState.status === "LIVE";
  const bidIncrement = settings?.bidIncrement ?? 500;
  const leadingTeam = auctionState.currentBidTeamId;

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [bidAmount, setBidAmount] = useState<string>("");
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<unknown>) {
    setLoadingAction(action);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingAction(null);
    }
  }

  // Input is a raise amount added on top of current/base price — not an absolute bid.
  const raiseValue = Number(bidAmount);
  const raiseAmount =
    Number.isFinite(raiseValue) && raiseValue > 0 ? raiseValue : bidIncrement;
  const finalBid = auctionState.currentBid + raiseAmount;

  const increments = [
    bidIncrement,
    bidIncrement * 2,
    bidIncrement * 5,
    bidIncrement * 10,
  ];

  return (
    <div className="space-y-5">
      {canControl && !isLive && (
        <div className="space-y-2">
          <Label>Start Next Player</Label>
          <div className="flex gap-2">
            <Select
              value={selectedPlayerId}
              onValueChange={(v) => setSelectedPlayerId(v ?? "")}
            >
              <SelectTrigger className="flex-1">
                <SelectValue>
                  {(v: string) =>
                    pendingPlayers.find((p) => p._id === v)?.name ??
                    "Select a player"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pendingPlayers.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No pending players
                  </div>
                )}
                {pendingPlayers.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} — {p.status === "UNSOLD" ? "re-auction" : p.categoryId?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!selectedPlayerId || loadingAction === "start"}
              onClick={() =>
                run("start", async () => {
                  await postJSON("/api/auction/start", { playerId: selectedPlayerId });
                  setSelectedPlayerId("");
                })
              }
            >
              {loadingAction === "start" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Start
            </Button>
          </div>
        </div>
      )}

      {canBid && isLive && !myTeam && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          Your account isn&apos;t linked to a team — ask an admin to fix this before
          you can bid.
        </div>
      )}

      {canBid && isLive && myTeam && (
        <div className="space-y-2">
          <Label>Bidding for {myTeam.name}</Label>
          {leadingTeam?._id === myTeam._id ? (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                You are the highest bidder at{" "}
                <span className="font-semibold text-live tabular-money">
                  ₹{auctionState.currentBid.toLocaleString("en-IN")}
                </span>
                .
              </p>
              {(() => {
                const mine = state.teams.find((t) => t._id === myTeam._id);
                if (!mine) return null;
                const free = Math.max(0, mine.remaining - auctionState.currentBid);
                return (
                  <p className="text-muted-foreground">
                    Free to allocate:{" "}
                    <span className="font-semibold text-sold tabular-money">
                      ₹{free.toLocaleString("en-IN")}
                    </span>
                  </p>
                );
              })()}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Current ₹{auctionState.currentBid.toLocaleString("en-IN")} · your
                bid will be{" "}
                <span className="font-semibold text-foreground tabular-money">
                  ₹{finalBid.toLocaleString("en-IN")}
                </span>
                {myTeam &&
                  (() => {
                    const mine = state.teams.find((t) => t._id === myTeam._id);
                    if (!mine) return null;
                    const leftAfter = Math.max(0, mine.remaining - finalBid);
                    return (
                      <>
                        {" "}
                        · free after bid{" "}
                        <span className="font-semibold text-sold tabular-money">
                          ₹{leftAfter.toLocaleString("en-IN")}
                        </span>
                      </>
                    );
                  })()}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="raise-amount" className="text-xs text-muted-foreground">
                    Raise by
                  </Label>
                  <Input
                    id="raise-amount"
                    type="number"
                    min={bidIncrement}
                    step={bidIncrement}
                    className="w-36"
                    placeholder={String(bidIncrement)}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    disabled={auctionState.timerPaused}
                  />
                </div>
                <Button
                  disabled={loadingAction === "bid" || auctionState.timerPaused}
                  onClick={() =>
                    run("bid", async () => {
                      if (raiseAmount < bidIncrement) {
                        throw new Error(
                          `Raise must be at least ₹${bidIncrement.toLocaleString("en-IN")}`
                        );
                      }
                      if (raiseAmount % bidIncrement !== 0) {
                        throw new Error(
                          `Raise must be in steps of ₹${bidIncrement.toLocaleString("en-IN")}`
                        );
                      }
                      await postJSON("/api/auction/bid", {
                        teamId: myTeam._id,
                        amount: auctionState.currentBid + raiseAmount,
                      });
                      setBidAmount("");
                    })
                  }
                >
                  {loadingAction === "bid" && <Loader2 className="size-4 animate-spin" />}
                  Bid ₹{finalBid.toLocaleString("en-IN")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {increments.map((inc) => (
                  <Button
                    key={inc}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={auctionState.timerPaused}
                    onClick={() =>
                      setBidAmount(String((Number(bidAmount) || 0) + inc))
                    }
                  >
                    +₹{inc.toLocaleString("en-IN")}
                  </Button>
                ))}
                {bidAmount && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={auctionState.timerPaused}
                    onClick={() => setBidAmount("")}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {auctionState.timerPaused && (
                <p className="text-xs text-muted-foreground">
                  Bidding is paused until the timer resumes.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {canControl && isLive && (
        <div className="flex flex-wrap items-center gap-2">
          {auctionState.timerPaused ? (
            <Button
              variant="outline"
              size="sm"
              disabled={loadingAction === "resume"}
              onClick={() => run("resume", () => postJSON("/api/auction/resume"))}
            >
              <Play className="size-4" />
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={!auctionState.timerEnabled || loadingAction === "pause"}
              onClick={() => run("pause", () => postJSON("/api/auction/pause"))}
            >
              <Pause className="size-4" />
              Pause
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={loadingAction === "reset"}
            onClick={() => run("reset", () => postJSON("/api/auction/reset"))}
          >
            <RotateCcw className="size-4" />
            Reset Bid
          </Button>

          <div className="ml-auto flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <Timer className="size-3.5 text-muted-foreground" />
            <Label htmlFor="timer-toggle" className="text-xs text-muted-foreground">
              Timer
            </Label>
            <Switch
              id="timer-toggle"
              checked={auctionState.timerEnabled}
              onCheckedChange={(checked) =>
                run("timer", () => postJSON("/api/auction/timer", { enabled: checked }))
              }
            />
          </div>
        </div>
      )}

      {canSell && !isLive && (
        <p className="text-sm text-muted-foreground">
          Waiting for the next player to be started.
        </p>
      )}

      {canSell && isLive && (
        <div
          className={
            canControl || canBid
              ? "flex gap-2 border-t border-border pt-4"
              : "flex gap-2"
          }
        >
          <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
            <DialogTrigger
              render={
                <Button
                  className="flex-1 bg-sold text-sold-foreground hover:bg-sold/90"
                  disabled={!leadingTeam}
                >
                  <Gavel className="size-4" />
                  Sell Player
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm sale</DialogTitle>
                <DialogDescription>
                  Sell {auctionState.currentPlayerId?.name} to{" "}
                  <strong>{leadingTeam?.name}</strong> for ₹
                  {auctionState.currentBid.toLocaleString("en-IN")}.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  disabled={!leadingTeam || loadingAction === "sell"}
                  onClick={() =>
                    run("sell", async () => {
                      await postJSON("/api/auction/sell", {
                        teamId: leadingTeam?._id,
                      });
                      setSellDialogOpen(false);
                    })
                  }
                >
                  {loadingAction === "sell" && <Loader2 className="size-4 animate-spin" />}
                  Confirm Sale
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className="flex-1 border-unsold text-unsold-foreground hover:bg-unsold/20"
                  disabled={loadingAction === "unsold"}
                >
                  <Ban className="size-4" />
                  Mark Unsold
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark player unsold?</AlertDialogTitle>
                <AlertDialogDescription>
                  {leadingTeam
                    ? `${auctionState.currentPlayerId?.name} currently has a high bid from ${leadingTeam.name} at ₹${auctionState.currentBid.toLocaleString("en-IN")}. Forcing unsold will discard that bid.`
                    : `${auctionState.currentPlayerId?.name} will be marked unsold and can be re-auctioned later.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    run("unsold", () =>
                      postJSON("/api/auction/unsold", {
                        force: Boolean(leadingTeam),
                      })
                    );
                  }}
                >
                  {leadingTeam ? "Force Unsold" : "Mark Unsold"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
