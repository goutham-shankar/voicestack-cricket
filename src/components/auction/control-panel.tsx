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
  canSell,
}: {
  state: FullAuctionState;
  /** Start player, pause/resume/reset, toggle timer. */
  canControl: boolean;
  /** Record the offline sale result or mark unsold. */
  canSell: boolean;
}) {
  const { auctionState, pendingPlayers } = state;
  const isLive = auctionState.status === "LIVE";
  const player = auctionState.currentPlayerId;
  const basePrice = player
    ? (player.basePriceOverride ?? player.categoryId?.defaultBasePrice ?? 0)
    : 0;

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [sellTeamId, setSellTeamId] = useState<string>("");
  const [sellPrice, setSellPrice] = useState<string>("");
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

  const priceValue = Number(sellPrice);
  const priceValid = Number.isFinite(priceValue) && priceValue > 0;
  const sellTeam = state.teams.find((t) => t._id === sellTeamId);

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
            Reset Timer
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
          className={canControl ? "flex gap-2 border-t border-border pt-4" : "flex gap-2"}
        >
          <Dialog
            open={sellDialogOpen}
            onOpenChange={(next) => {
              setSellDialogOpen(next);
              if (next) {
                setSellTeamId("");
                setSellPrice(basePrice ? String(basePrice) : "");
              }
            }}
          >
            <DialogTrigger
              render={
                <Button className="flex-1 bg-sold text-sold-foreground hover:bg-sold/90">
                  <Gavel className="size-4" />
                  Record Sale
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record offline sale</DialogTitle>
                <DialogDescription>
                  Bidding for {player?.name} happens verbally in the room — enter who
                  won and the final hammer price.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Winning Team</Label>
                  <Select value={sellTeamId} onValueChange={(v) => setSellTeamId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          state.teams.find((t) => t._id === v)?.name ?? "Select a team"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {state.teams.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.name} · ₹{t.remaining.toLocaleString("en-IN")} left
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell-price">Sold Price (₹)</Label>
                  <Input
                    id="sell-price"
                    type="number"
                    min={1}
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                  />
                  {sellTeam && priceValid && priceValue > sellTeam.remaining && (
                    <p className="text-xs text-destructive">
                      Exceeds {sellTeam.name}&apos;s remaining wallet of ₹
                      {sellTeam.remaining.toLocaleString("en-IN")}.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!sellTeamId || !priceValid || loadingAction === "sell"}
                  onClick={() =>
                    run("sell", async () => {
                      await postJSON("/api/auction/sell", {
                        teamId: sellTeamId,
                        price: Math.round(priceValue),
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
                  {player?.name} will be marked unsold and can be re-auctioned later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    run("unsold", () => postJSON("/api/auction/unsold"));
                  }}
                >
                  Mark Unsold
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
