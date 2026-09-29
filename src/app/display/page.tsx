"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimationControls,
} from "framer-motion";
import { useAuctionState } from "@/lib/use-auction-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuctionTimer } from "@/components/auction/auction-timer";
import { AnimatedBidAmount } from "@/components/auction/animated-bid-amount";
import { Trophy, Ban, Circle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import type { AuctionResult, BidRecord } from "@/lib/auction-types";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 220, damping: 22 },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export default function DisplayPage() {
  const [flash, setFlash] = useState<AuctionResult | null>(null);
  const [bidPulse, setBidPulse] = useState(0);
  const prevBidRef = useRef<number | null>(null);
  const bidShake = useAnimationControls();

  const { state } = useAuctionState({
    onSold: (result) => {
      setFlash(result);
      setTimeout(() => setFlash(null), 6500);
    },
    onUnsold: (result) => {
      setFlash(result);
      setTimeout(() => setFlash(null), 4500);
    },
  });

  useEffect(() => {
    document.title = "Live Auction Display";
  }, []);

  const isLive = state?.auctionState.status === "LIVE";
  const liveBid = state?.auctionState.currentBid ?? 0;

  useEffect(() => {
    if (!isLive) {
      prevBidRef.current = liveBid;
      return;
    }
    const prev = prevBidRef.current;
    prevBidRef.current = liveBid;
    if (prev == null || liveBid <= prev) return;
    setBidPulse((n) => n + 1);
    void bidShake.start({
      scale: [1, 1.045, 1],
      x: [0, -3, 3, -2, 0],
      transition: { type: "tween", duration: 0.45, ease: "easeOut" },
    });
  }, [isLive, liveBid, bidShake]);

  if (!state) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <BrandLogo size={72} className="rounded-2xl opacity-90" />
          </motion.div>
          <p className="text-lg tracking-wide">Connecting to auction…</p>
        </motion.div>
      </div>
    );
  }

  const player = state.auctionState.currentPlayerId;
  const bidAmount = isLive
    ? state.auctionState.currentBid
    : (player?.basePriceOverride ?? player?.categoryId?.defaultBasePrice ?? 0);
  const leadingTeam = state.auctionState.currentBidTeamId;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
      <Atmosphere isLive={!!isLive} bidPulse={bidPulse} />

      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10"
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={isLive ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 2.2, repeat: isLive ? Infinity : 0, ease: "easeInOut" }}
          >
            <BrandLogo size={40} className="rounded-xl" />
          </motion.div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide md:text-base">
              Voicestack Cricket League
            </p>
            <p className="text-xs text-muted-foreground md:text-sm">Live Auction Board</p>
          </div>
        </div>

        <motion.div
          key={isLive ? "live" : "idle"}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wider",
            isLive
              ? "bg-live/15 text-live shadow-[0_0_24px_color-mix(in_oklch,var(--live)_35%,transparent)]"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isLive && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-live/20"
              animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          )}
          <Circle className={cn("relative size-2.5 fill-current", isLive && "animate-pulse")} />
          <span className="relative">{isLive ? "Live" : "Idle"}</span>
        </motion.div>
      </motion.header>

      {/* Stage */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 py-4 md:px-10">
        <AnimatePresence mode="wait">
          {!player ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-7 text-center"
            >
              <div className="relative">
                <motion.div
                  aria-hidden
                  className="absolute -inset-10 rounded-full bg-primary/15 blur-3xl"
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, 2, -2, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <BrandLogo size={128} className="relative rounded-3xl shadow-2xl" />
                </motion.div>
              </div>
              <div>
                <motion.p
                  className="text-3xl font-semibold tracking-tight md:text-5xl"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                >
                  Waiting for next player
                </motion.p>
                <p className="mt-3 text-lg text-muted-foreground">
                  The auction will resume shortly
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={player._id}
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
              transition={{ duration: 0.35 }}
              className="grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14"
            >
              {/* Player portrait */}
              <motion.div variants={fadeUp} className="flex flex-col items-center gap-5 lg:items-start">
                <div className="relative">
                  <motion.div
                    aria-hidden
                    className="absolute -inset-5 rounded-[2.2rem] bg-primary/20 blur-2xl"
                    animate={
                      isLive
                        ? { opacity: [0.35, 0.75, 0.35], scale: [0.96, 1.05, 0.96] }
                        : { opacity: 0.35, scale: 1 }
                    }
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    initial={{ scale: 0.88, rotate: -3 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 180, damping: 16 }}
                  >
                    <Avatar className="relative size-56 rounded-[1.75rem] ring-2 ring-primary/40 sm:size-72 lg:size-80">
                      {player.avatarUrl && (
                        <AvatarImage src={player.avatarUrl} alt="" className="object-cover" />
                      )}
                      <AvatarFallback className="rounded-[1.75rem] bg-secondary text-6xl font-bold sm:text-7xl">
                        {player.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                </div>

                <motion.div variants={fadeUp} className="text-center lg:text-left">
                  <motion.p
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm font-semibold uppercase tracking-[0.2em] text-primary"
                  >
                    {player.categoryId?.name ?? "Player"}
                    {player.role ? ` · ${player.role}` : ""}
                  </motion.p>
                  <StaggerName name={player.name} />
                  {player.tagIds.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
                      {player.tagIds.map((tag, i) => (
                        <motion.span
                          key={tag._id}
                          initial={{ opacity: 0, y: 8, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: 0.25 + i * 0.06, type: "spring", stiffness: 280 }}
                          className="rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                          style={{
                            backgroundColor: `${tag.color}26`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </motion.span>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>

              {/* Bid stage */}
              <motion.div
                variants={fadeUp}
                className="relative flex flex-col items-center gap-6 text-center lg:items-stretch lg:text-left"
              >
                <motion.div className="relative w-full" animate={bidShake}>
                  <AnimatedBidAmount
                    amount={bidAmount}
                    size="lg"
                    label={isLive ? "Current Bid" : "Base Price"}
                  />
                </motion.div>

                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
                  <motion.div
                    layout
                    animate={
                      leadingTeam
                        ? {
                            boxShadow: [
                              "0 0 0px color-mix(in oklch, var(--primary) 0%, transparent)",
                              "0 0 36px color-mix(in oklch, var(--primary) 28%, transparent)",
                              "0 0 18px color-mix(in oklch, var(--primary) 12%, transparent)",
                            ],
                          }
                        : {}
                    }
                    transition={{ duration: 0.7 }}
                    className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/80 bg-card/50 px-5 py-4 backdrop-blur-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Leading Team
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={leadingTeam?._id ?? "none"}
                        initial={{ opacity: 0, y: 18, filter: "blur(6px)", scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
                        exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                        transition={{ type: "spring", stiffness: 280, damping: 20 }}
                        className="mt-1 flex items-center justify-center gap-2 truncate text-2xl font-bold sm:text-3xl lg:justify-start"
                      >
                        {leadingTeam ? (
                          <>
                            <motion.span
                              animate={{ rotate: [0, -14, 14, 0], scale: [1, 1.2, 1] }}
                              transition={{ type: "tween", duration: 0.6, ease: "easeOut" }}
                            >
                              <Trophy className="size-6 shrink-0 text-primary" />
                            </motion.span>
                            <span className="truncate">{leadingTeam.name}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </motion.p>
                    </AnimatePresence>
                    <motion.p
                      key={state.auctionState.bidCount}
                      initial={{ opacity: 0.4, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {state.auctionState.bidCount} bid
                      {state.auctionState.bidCount === 1 ? "" : "s"}
                    </motion.p>
                  </motion.div>

                  {isLive && state.auctionState.timerEnabled && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 18 }}
                    >
                      <AuctionTimer
                        auctionState={state.auctionState}
                        size="lg"
                        className="bg-card/50 backdrop-blur-sm"
                      />
                    </motion.div>
                  )}
                </div>

                <BiddingTeamsList
                  bids={state.bidHistory}
                  leadingTeamId={leadingTeam?._id}
                  bidPulse={bidPulse}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BidQuoteGraph bids={state.bidHistory} isLive={!!isLive} />

      {/* Sold / Unsold flash */}
      <AnimatePresence>
        {flash && <ResultFlash key={flashKey(flash)} flash={flash} />}
      </AnimatePresence>
    </div>
  );
}

function StaggerName({ name }: { name: string }) {
  return (
    <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
      {name.split("").map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            delay: 0.08 + i * 0.028,
            type: "spring",
            stiffness: 320,
            damping: 22,
          }}
          className="inline-block"
          style={{ whiteSpace: char === " " ? "pre" : undefined }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </h1>
  );
}

function Atmosphere({ isLive, bidPulse }: { isLive: boolean; bidPulse: number }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(70% 55% at 50% -10%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%),
            radial-gradient(40% 40% at 100% 100%, color-mix(in oklch, var(--live) 8%, transparent), transparent 60%),
            radial-gradient(35% 35% at 0% 100%, color-mix(in oklch, var(--sold) 7%, transparent), transparent 55%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-primary/10 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-1/4 size-80 rounded-full bg-live/10 blur-3xl"
        animate={{
          x: [0, -30, 0],
          y: [0, -40, 0],
          opacity: isLive ? [0.2, 0.55, 0.2] : [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {isLive && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-live to-transparent"
          animate={{ opacity: [0.2, 0.9, 0.2], scaleX: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      )}
      <AnimatePresence>
        {bidPulse > 0 && (
          <motion.div
            key={bidPulse}
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-live/8"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type ConfettiPiece = {
  id: number;
  x: number;
  y: number;
  r: number;
  delay: number;
  size: number;
  hue: string;
};

function flashKey(flash: AuctionResult) {
  return flash.status === "SOLD"
    ? `sold-${flash.playerName}-${flash.teamName}-${flash.price}`
    : `unsold-${flash.playerName}`;
}

function makeConfetti(sold: boolean): ConfettiPiece[] {
  return Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 520,
    y: 180 + Math.random() * 280,
    r: Math.random() * 360,
    delay: Math.random() * 0.25,
    size: 6 + Math.random() * 10,
    hue: sold
      ? ["var(--sold)", "var(--primary)", "var(--live)"][i % 3]
      : "var(--muted-foreground)",
  }));
}

function ResultFlash({ flash }: { flash: AuctionResult }) {
  const sold = flash.status === "SOLD";
  const rings = [0, 1, 2, 3];
  // Remounted per-event via the `key` on ResultFlash (see flashKey), so this
  // lazy initializer runs exactly once per result — a fresh burst each time.
  const [confetti] = useState<ConfettiPiece[]>(() => makeConfetti(sold));

  return (
    <motion.div
      key={`${flash.status}-${flash.playerName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      className={cn(
        "absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 backdrop-blur-md",
        sold ? "bg-sold/25" : "bg-unsold/45"
      )}
    >
      {rings.map((i) => (
        <motion.div
          key={i}
          aria-hidden
          className={cn(
            "pointer-events-none absolute size-40 rounded-full border-2 sm:size-56",
            sold ? "border-sold/40" : "border-unsold-foreground/30"
          )}
          initial={{ scale: 0.4, opacity: 0.7 }}
          animate={{ scale: 2.4 + i * 0.35, opacity: 0 }}
          transition={{ duration: 1.4, delay: i * 0.12, ease: "easeOut" }}
        />
      ))}

      {sold &&
        confetti.map((p) => (
          <motion.span
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute top-1/3 rounded-sm"
            style={{
              width: p.size,
              height: p.size * 0.55,
              background: p.hue,
            }}
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: p.x,
              y: p.y,
              rotate: p.r,
              scale: 1,
            }}
            transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
          />
        ))}

      <motion.div
        initial={{ scale: 0.55, y: 40, rotate: -4, opacity: 0 }}
        animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
        exit={{ scale: 1.08, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="relative flex flex-col items-center gap-4 text-center"
      >
        {sold ? (
          <>
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] }}
              transition={{ type: "tween", duration: 1.2, repeat: 2, ease: "easeInOut" }}
            >
              <Trophy className="size-20 text-sold sm:size-24" />
            </motion.div>
            <motion.p
              initial={{ letterSpacing: "0.55em", opacity: 0, scale: 0.85 }}
              animate={{ letterSpacing: "0.02em", opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 16 }}
              className="text-6xl font-black tracking-tight text-sold sm:text-8xl"
            >
              SOLD
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-3xl font-semibold sm:text-4xl"
            >
              {flash.playerName}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-xl text-muted-foreground sm:text-2xl"
            >
              to <span className="font-bold text-foreground">{flash.teamName}</span>
            </motion.p>
            <motion.p
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1.12, 1], opacity: 1 }}
              transition={{
                delay: 0.35,
                type: "tween",
                duration: 0.55,
                ease: "easeOut",
              }}
              className="tabular-money text-4xl font-bold text-primary sm:text-5xl"
            >
              ₹{flash.price.toLocaleString("en-IN")}
            </motion.p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ rotate: -20, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Ban className="size-20 text-unsold-foreground sm:size-24" />
            </motion.div>
            <motion.p
              initial={{ letterSpacing: "0.4em", opacity: 0 }}
              animate={{ letterSpacing: "0.02em", opacity: 1 }}
              className="text-6xl font-black tracking-tight text-unsold-foreground sm:text-8xl"
            >
              UNSOLD
            </motion.p>
            <p className="text-3xl font-semibold sm:text-4xl">{flash.playerName}</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function BidQuoteGraph({
  bids,
  isLive,
}: {
  bids: BidRecord[];
  isLive: boolean;
}) {
  const quotes = useMemo(() => {
    const chronological = [...bids].reverse();
    return chronological.map((bid, index) => ({
      id: String(bid._id),
      index: index + 1,
      amount: bid.amount,
      teamId: String(bid.teamId?._id ?? ""),
      name: bid.teamId?.name ?? "Unknown",
      short:
        (bid.teamId?.name ?? "?")
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 3)
          .toUpperCase() || "?",
    }));
  }, [bids]);

  const chart = useMemo(() => {
    const W = 1000;
    const H = 160;
    const padX = 16;
    const padTop = 18;
    const padBottom = 22;
    const plotW = W - padX * 2;
    const plotH = H - padTop - padBottom;
    const empty = {
      W,
      H,
      padTop,
      plotH,
      points: [] as { x: number; y: number; q: (typeof quotes)[number] }[],
      line: "",
      area: "",
    };

    if (quotes.length === 0) return empty;

    // Scale to the bid range so a hike climbs the chart instead of sitting flat.
    const amounts = quotes.map((q) => q.amount);
    const minRaw = Math.min(...amounts);
    const maxRaw = Math.max(...amounts);
    const pad = Math.max((maxRaw - minRaw) * 0.18, 1);
    const min = minRaw - pad;
    const max = maxRaw + pad;
    const span = max - min || 1;

    const points = quotes.map((q, i) => {
      const x =
        quotes.length === 1 ? padX + plotW / 2 : padX + (i / (quotes.length - 1)) * plotW;
      const y = padTop + (1 - (q.amount - min) / span) * plotH;
      return { x, y, q };
    });

    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const baseline = padTop + plotH;
    const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${baseline.toFixed(1)} L ${points[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`;

    return { W, H, padTop, plotH, points, line, area };
  }, [quotes]);

  const last = quotes[quotes.length - 1];
  const prev = quotes[quotes.length - 2];
  const up = !prev || !last ? true : last.amount >= prev.amount;
  const stroke = up ? "var(--sold)" : "var(--live)";

  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative z-10 bg-transparent px-4 py-3 md:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Live quotes
            </p>
            {last && (
              <motion.p
                key={last.id}
                initial={{ opacity: 0.5, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "tabular-money text-lg font-black sm:text-xl",
                  up ? "text-sold" : "text-live"
                )}
              >
                ₹{last.amount.toLocaleString("en-IN")}
                <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {last.name}
                </span>
              </motion.p>
            )}
          </div>
          {quotes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {isLive ? "Waiting for the first quote…" : "No quotes this lot"}
            </p>
          )}
        </div>

        <div className="relative h-36 w-full overflow-hidden">
          {quotes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {isLive ? "Market open — awaiting first bid" : "Market idle"}
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chart.W} ${chart.H}`}
              className="h-full w-full bg-transparent"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="quoteFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.12" />
                  <stop offset="55%" stopColor={stroke} stopOpacity="0.04" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d={chart.area} fill="url(#quoteFill)" />

              <path
                d={chart.line}
                fill="none"
                stroke={stroke}
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {chart.points.map((p, i) => {
                const isLast = i === chart.points.length - 1;
                return (
                  <text
                    key={p.q.id}
                    x={p.x}
                    y={chart.H - 6}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={isLast ? 0.9 : 0.4}
                    fontSize="10"
                    fontWeight="600"
                  >
                    {p.q.short}
                  </text>
                );
              })}
            </svg>
          )}

          {isLive && quotes.length > 0 && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute right-3 top-2 h-1.5 w-1.5 rounded-full"
              style={{ background: stroke }}
              animate={{ opacity: [1, 0.25, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
        </div>
      </div>
    </motion.footer>
  );
}

function BiddingTeamsList({
  bids,
  leadingTeamId,
  bidPulse,
}: {
  bids: BidRecord[];
  leadingTeamId?: string | null;
  bidPulse: number;
}) {
  const rows = useMemo(() => {
    const latestByTeam = new Map<
      string,
      { teamId: string; name: string; logoUrl: string | null; amount: number }
    >();

    for (const bid of bids) {
      const id = String(bid.teamId?._id ?? "");
      if (!id || latestByTeam.has(id)) continue;
      latestByTeam.set(id, {
        teamId: id,
        name: bid.teamId?.name ?? "Unknown team",
        logoUrl: bid.teamId?.logoUrl ?? null,
        amount: bid.amount,
      });
    }

    return [...latestByTeam.values()].sort((a, b) => b.amount - a.amount);
  }, [bids]);

  if (rows.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="rounded-2xl border border-dashed border-border/80 px-5 py-4 text-sm text-muted-foreground"
      >
        Waiting for the first bid…
      </motion.div>
    );
  }

  return (
    <LayoutGroup>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full rounded-2xl border border-border/80 bg-card/40 px-4 py-3 backdrop-blur-sm"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Teams Bidding · {rows.length}
        </p>
        <ul className={cn("grid gap-2", rows.length > 2 && "sm:grid-cols-2")}>
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((row, index) => {
              const isLeading = row.teamId === leadingTeamId;
              return (
                <motion.li
                  key={row.teamId}
                  layout
                  initial={{ opacity: 0, x: -16, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl border px-3 py-2.5",
                    isLeading
                      ? "border-primary/50 bg-primary/10 shadow-[0_0_28px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
                      : "border-border/60 bg-background/40"
                  )}
                >
                  {isLeading && bidPulse > 0 && (
                    <motion.span
                      key={bidPulse}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl bg-primary/15"
                      initial={{ opacity: 0.55, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.04 }}
                      transition={{ type: "tween", duration: 0.45, ease: "easeOut" }}
                    />
                  )}
                  <motion.span
                    layout
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isLeading
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </motion.span>
                  <Avatar className="size-9 rounded-lg">
                    {row.logoUrl && <AvatarImage src={row.logoUrl} alt="" />}
                    <AvatarFallback className="rounded-lg bg-secondary text-[10px]">
                      {row.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold sm:text-base">{row.name}</p>
                    {isLeading && (
                      <motion.p
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] font-semibold uppercase tracking-wide text-primary"
                      >
                        Leading
                      </motion.p>
                    )}
                  </div>
                  <motion.p
                    key={row.amount}
                    initial={{ scale: 1.25, color: "var(--sold)", y: -4 }}
                    animate={{ scale: 1, color: "var(--primary)", y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className="tabular-money text-sm font-bold sm:text-base"
                  >
                    ₹{row.amount.toLocaleString("en-IN")}
                  </motion.p>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </motion.div>
    </LayoutGroup>
  );
}
