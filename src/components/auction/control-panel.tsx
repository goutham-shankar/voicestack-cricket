"use client";

import { fmt } from "@/lib/auction-engine";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Gavel,
  Trophy,
  Ban,
  Loader2,
} from "lucide-react";
import type { FullAuctionState } from "@/lib/auction-types";

async function postJSON(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
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
  /** Bring a player up for auction. */
  canControl: boolean;
  /** Record the offline sale result or mark unsold. */
  canSell: boolean;
}) {
  const { auctionState, pendingPlayers } = state;
  const isLive = auctionState.status === "LIVE";
  const showcaseOn = auctionState.showcase === true;
  const player = auctionState.currentPlayerId;
  const basePrice = player
    ? (player.basePriceOverride ?? player.categoryId?.defaultBasePrice ?? 0)
    : 0;

  const [sellTeamId, setSellTeamId] = useState<string>("");
  // Always starts empty and is only ever typed by the admin — the hammer price
  // is never pre-filled or re-filled from the base price, so nothing in this
  // field moves on its own while a lot is live.
  const [sellPrice, setSellPrice] = useState<string>("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Clear the sale form when a new lot goes live, so the previous lot's winner
  // and price can never be submitted against the wrong player. Adjusting state
  // during render (rather than in an effect) avoids a wasted commit with stale
  // values.
  const livePlayerId = player?._id ?? null;
  const [formLotId, setFormLotId] = useState(livePlayerId);
  if (formLotId !== livePlayerId) {
    setFormLotId(livePlayerId);
    setSellTeamId("");
    setSellPrice("");
  }

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
          <div className="flex items-baseline justify-between gap-3">
            <Label>Auction Order</Label>
            <span className="text-xs text-muted-foreground">
              {pendingPlayers.length} pending
            </span>
          </div>

          {pendingPlayers.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No pending players. Every lot has been auctioned.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="text-right">Base Price</TableHead>
                    <TableHead className="w-28 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPlayers.map((p, i) => {
                    const base =
                      p.basePriceOverride ?? p.categoryId?.defaultBasePrice ?? 0;
                    const starting = loadingAction === `start-${p._id}`;
                    return (
                      <TableRow
                        key={p._id}
                        className={i === 0 ? "bg-primary/5" : undefined}
                      >
                        <TableCell className="text-center text-sm font-semibold tabular-nums text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-8">
                              {p.avatarUrl && (
                                <AvatarImage src={p.avatarUrl} alt="" className="object-cover" />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {p.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.name}</p>
                              <div className="flex items-center gap-1.5">
                                {p.role && (
                                  <span className="text-xs text-muted-foreground">{p.role}</span>
                                )}
                                {p.status === "UNSOLD" && (
                                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                    Re-auction
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {p.categoryId?.name ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-money text-right text-sm font-medium">
                          {fmt(base)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={i === 0 ? "default" : "outline"}
                            disabled={loadingAction !== null}
                            onClick={() =>
                              run(`start-${p._id}`, () =>
                                postJSON("/api/auction/start", { playerId: p._id })
                              )
                            }
                          >
                            {starting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Play className="size-4" />
                            )}
                            Start
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {canControl && !isLive && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Trophy className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Final Squads Showcase</p>
            <p className="text-xs text-muted-foreground">
              Cycles every team and its full squad on the display board.
            </p>
          </div>
          <Button
            variant={showcaseOn ? "default" : "outline"}
            size="sm"
            disabled={loadingAction === "showcase"}
            onClick={() =>
              run("showcase", () =>
                postJSON("/api/auction/showcase", { enabled: !showcaseOn })
              )
            }
          >
            {loadingAction === "showcase" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trophy className="size-4" />
            )}
            {showcaseOn ? "Stop Showcase" : "Show Final Squads"}
          </Button>
        </div>
      )}

      {canSell && !isLive && !showcaseOn && (
        <p className="text-sm text-muted-foreground">
          Waiting for the next player to be started.
        </p>
      )}

      {canSell && isLive && (
        <div className={canControl ? "space-y-3 border-t border-border pt-4" : "space-y-3"}>
          <p className="text-sm text-muted-foreground">
            Bidding for {player?.name} happens verbally in the room — enter who won
            and the final hammer price.
          </p>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
            <div className="space-y-1.5">
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
                      {t.name} · {fmt(t.remaining)} left
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sell-price">Sold Price</Label>
              <Input
                id="sell-price"
                type="number"
                min={1}
                value={sellPrice}
                placeholder={
                  basePrice
                    ? `Base ₹${basePrice.toLocaleString("en-IN")}`
                    : "Enter hammer price"
                }
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          </div>

          {sellTeam && priceValid && priceValue > sellTeam.remaining && (
            <p className="text-xs text-destructive">
              Exceeds {sellTeam.name}&apos;s remaining wallet of
              {fmt(sellTeam.remaining)}.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-sold text-sold-foreground hover:bg-sold/90"
              disabled={!sellTeamId || !priceValid || loadingAction === "sell"}
              onClick={() =>
                run("sell", () =>
                  postJSON("/api/auction/sell", {
                    teamId: sellTeamId,
                    price: Math.round(priceValue),
                  })
                )
              }
            >
              {loadingAction === "sell" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Gavel className="size-4" />
              )}
              Confirm Sale
            </Button>

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
        </div>
      )}
    </div>
  );
}
