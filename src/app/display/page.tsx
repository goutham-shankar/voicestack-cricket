"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuctionState } from "@/lib/use-auction-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuctionTimer } from "@/components/auction/auction-timer";
import { AnimatedBidAmount, MoneyFigure } from "@/components/auction/animated-bid-amount";
import { Trophy, Circle, Gavel } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { IdleMatchBackground } from "@/components/auction/idle-match-background";
import { cn } from "@/lib/utils";
import type { AuctionResult, PlayerRef, RecentSale } from "@/lib/auction-types";

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state } = useAuctionState({
    onSold: (result) => {
      setFlash(result);
      setTimeout(() => setFlash(null), 10000);
      const audio = audioRef.current;
      if (audio) {
        if (audioStopRef.current) clearTimeout(audioStopRef.current);
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        audioStopRef.current = setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, 7000);
      }
    },
    onUnsold: (result) => {
      setFlash(result);
      setTimeout(() => setFlash(null), 4500);
    },
  });

  useEffect(() => {
    document.title = "Live Auction Display";
  }, []);

  useEffect(() => {
    // Browsers block audio-with-sound until the page has seen a user gesture.
    // Silently prime playback on the first click/keypress anywhere so the
    // later programmatic play() on a SOLD event isn't blocked — no visible UI.
    function primeAudio() {
      const audio = audioRef.current;
      if (!audio) return;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {});
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    }
    window.addEventListener("pointerdown", primeAudio);
    window.addEventListener("keydown", primeAudio);
    return () => {
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    };
  }, []);

  const isLive = state?.auctionState.status === "LIVE";

  if (!state) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <audio ref={audioRef} src="/audio/ipl-theme.mp3" playsInline />
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
          <motion.div
            animate={{ y: [0, -22, 0], rotate: [0, 300] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          >
            <CricketBall size={22} />
          </motion.div>
          <p className="text-lg tracking-wide">Connecting to auction…</p>
        </motion.div>
      </div>
    );
  }

  const player = state.auctionState.currentPlayerId;
  const basePrice = player
    ? (player.basePriceOverride ?? player.categoryId?.defaultBasePrice ?? 0)
    : 0;

  return (
    <div
      className={cn(
        "relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground",
        !player && "dark"
      )}
    >
      <audio ref={audioRef} src="/audio/ipl-theme.mp3" playsInline />
      {player ? <Atmosphere isLive={!!isLive} /> : <IdleMatchBackground />}

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
          {isLive && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="ml-1 hidden sm:block"
            >
              <CricketBall size={22} />
            </motion.div>
          )}
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
            <IdleDashboard
              key="idle"
              upNext={state.pendingPlayers}
            />
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

              {/* Sale stage */}
              <motion.div
                variants={fadeUp}
                className="relative flex flex-col items-center gap-6 text-center lg:items-stretch lg:text-left"
              >
                <div className="relative w-full">
                  <AnimatedBidAmount amount={basePrice} size="lg" label="Base Price" />
                </div>

                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl border border-border/80 bg-card/50 px-5 py-4 backdrop-blur-sm"
                  >
                    <motion.span
                      animate={{ rotate: [0, -8, 8, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Gavel className="size-6 shrink-0 text-primary" />
                    </motion.span>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Bidding
                      </p>
                      <p className="mt-0.5 text-lg font-bold sm:text-xl">
                        Live in the room
                      </p>
                    </div>
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <RecentSalesTicker sales={state.recentSales} />

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
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </h1>
  );
}

function Atmosphere({ isLive }: { isLive: boolean }) {
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
      {/* Stadium floodlight sweeps */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-[10%] h-[140%] w-[26%] origin-top opacity-0"
        style={{
          background:
            "conic-gradient(from 0deg, transparent, color-mix(in oklch, var(--primary) 14%, transparent), transparent 22%)",
        }}
        animate={
          isLive
            ? { rotate: [-16, 16, -16], opacity: [0, 0.5, 0] }
            : { rotate: 0, opacity: 0 }
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 right-[10%] h-[140%] w-[26%] origin-top opacity-0"
        style={{
          background:
            "conic-gradient(from 0deg, transparent, color-mix(in oklch, var(--live) 12%, transparent), transparent 22%)",
        }}
        animate={
          isLive
            ? { rotate: [16, -16, 16], opacity: [0, 0.45, 0] }
            : { rotate: 0, opacity: 0 }
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      {/* Pitch stripe at the base, like a mowed cricket square */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-[0.05]"
        style={{
          background:
            "repeating-linear-gradient(90deg, var(--sold) 0px, var(--sold) 48px, transparent 48px, transparent 96px)",
          maskImage: "linear-gradient(to top, black, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent)",
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
    </>
  );
}

function IdleDashboard({
  upNext,
}: {
  upNext: PlayerRef[];
}) {
  const next = upNext.slice(0, 4);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
      className="flex w-full max-w-6xl flex-col items-center gap-8"
    >
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-6 text-center">
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
            <BrandLogo size={96} className="relative rounded-3xl shadow-2xl" />
          </motion.div>
        </div>
        <div>
          <motion.p
            className="text-2xl font-semibold tracking-tight md:text-4xl"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          >
            Waiting for next player
          </motion.p>
          <p className="mt-2 text-base text-muted-foreground md:text-lg">
            The auction will resume shortly
          </p>
        </div>
      </motion.div>

      {next.length > 0 && (
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Up next
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {next.map((p, i) => (
              <div
                key={p._id}
                className={cn(
                  "flex items-center gap-3 rounded-full border bg-black/55 py-1.5 pl-1.5 pr-5 backdrop-blur-md",
                  i === 0 ? "border-primary/60" : "border-white/10"
                )}
              >
                <Avatar className="size-9 rounded-full">
                  {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" className="object-cover" />}
                  <AvatarFallback className="bg-secondary text-[10px]">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.role}
                    {p.categoryId?.name ? ` · ${p.categoryId.name}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function CricketBall({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <circle cx="50" cy="50" r="46" fill="var(--live)" stroke="oklch(0.3 0.05 25)" strokeWidth="2" />
      <path
        d="M 12 32 Q 50 8 88 32"
        fill="none"
        stroke="oklch(0.95 0.02 90)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <path
        d="M 12 68 Q 50 92 88 68"
        fill="none"
        stroke="oklch(0.95 0.02 90)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

function SixCelebration() {
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-24 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.98 0.05 90) 0%, color-mix(in oklch, var(--sold) 60%, transparent) 45%, transparent 72%)",
          translate: "-140px 40px",
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], scale: [0.3, 2.2, 2.6] }}
        transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2"
        initial={{ x: -40, y: 30, opacity: 0, scale: 0.6 }}
        animate={{
          x: [-40, 60, 260, 480],
          y: [30, -20, -160, -360],
          rotate: [0, 200, 520, 900],
          opacity: [0, 1, 1, 0],
          scale: [0.6, 1, 0.9, 0.7],
        }}
        transition={{ delay: 0.32, duration: 1, ease: "easeOut" }}
      >
        <CricketBall size={30} />
      </motion.div>
      <motion.p
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 text-4xl font-black tracking-tight text-sold sm:text-5xl"
        initial={{ opacity: 0, scale: 0.5, y: 10 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1, 1], y: [10, 0, 0, -14] }}
        transition={{ delay: 0.45, duration: 1.1, ease: "easeOut" }}
      >
        SIX!
      </motion.p>
    </>
  );
}

function Stumps() {
  const positions = [-24, 0, 24];
  return (
    <svg viewBox="0 0 160 140" width={150} height={132} aria-hidden>
      {positions.map((offset, i) => (
        <motion.rect
          key={`stump-${i}`}
          x={80 + offset - 5}
          y="30"
          width="10"
          height="88"
          rx="4"
          fill="oklch(0.82 0.05 84)"
          stroke="oklch(0.55 0.05 75)"
          strokeWidth="1.5"
          style={{ transformOrigin: `${80 + offset}px 118px` }}
          initial={{ rotate: 0, x: 0 }}
          animate={{ rotate: (i - 1) * 46, x: (i - 1) * 26 }}
          transition={{ type: "spring", stiffness: 120, damping: 9, delay: 0.15 + i * 0.05 }}
        />
      ))}
      <motion.rect
        x="63"
        y="24"
        width="34"
        height="7"
        rx="3.5"
        fill="oklch(0.82 0.05 84)"
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        animate={{ x: -60, y: -70, rotate: -160, opacity: [1, 1, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.rect
        x="97"
        y="24"
        width="34"
        height="7"
        rx="3.5"
        fill="oklch(0.82 0.05 84)"
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        animate={{ x: 60, y: -80, rotate: 180, opacity: [1, 1, 0] }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.04 }}
      />
    </svg>
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
  return Array.from({ length: sold ? 46 : 28 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 640,
    y: 180 + Math.random() * 320,
    r: Math.random() * 360,
    delay: Math.random() * 0.3,
    size: 6 + Math.random() * 11,
    hue: sold
      ? ["var(--sold)", "var(--primary)", "var(--live)"][i % 3]
      : "var(--muted-foreground)",
  }));
}

/** Rolls the digits up from zero to the hammer price, odometer-style. */
function SoldPriceOdometer({ price }: { price: number }) {
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const start = window.setTimeout(() => {
      setRevealed(true);
      setSpinning(true);
    }, 450);
    const stop = window.setTimeout(() => setSpinning(false), 2600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, []);

  return (
    <MoneyFigure
      amount={revealed ? price : 0}
      fromAmount={0}
      casino
      spinning={spinning}
      spinKey={1}
      className="text-sold drop-shadow-[0_0_28px_color-mix(in_oklch,var(--sold)_55%,transparent)]"
      style={{ fontSize: "clamp(3rem, 8vw, 7.5rem)" }}
    />
  );
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
      {sold && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      )}

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

      {sold && <SixCelebration />}

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
              initial={{ scale: 0.6, opacity: 0, y: -16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="relative"
            >
              <Avatar className="size-28 rounded-2xl ring-4 ring-sold/60 shadow-2xl sm:size-32">
                {flash.playerAvatarUrl && (
                  <AvatarImage src={flash.playerAvatarUrl} alt="" className="object-cover" />
                )}
                <AvatarFallback className="rounded-2xl bg-secondary text-3xl font-bold sm:text-4xl">
                  {flash.playerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] }}
                transition={{ type: "tween", duration: 1.2, repeat: 2, ease: "easeInOut" }}
                className="absolute -bottom-3 -right-3 rounded-full bg-background p-1.5 shadow-lg"
              >
                <Trophy className="size-8 text-sold" />
              </motion.div>
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
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 180, damping: 14 }}
              className="relative"
            >
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-6 rounded-full bg-primary/30 blur-2xl"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.4, 1.6] }}
                transition={{ delay: 0.55, duration: 0.9, ease: "easeOut" }}
              />
              <SoldPriceOdometer price={flash.price} />
            </motion.div>
          </>
        ) : (
          <>
            <Stumps />
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

function RecentSalesTicker({ sales }: { sales: RecentSale[] }) {
  // Repeat the list until one group is wider than a large screen, then render it twice
  // so the -50% translate loops seamlessly.
  const group = useMemo(() => {
    if (sales.length === 0) return [];
    const reps = Math.max(1, Math.ceil(8 / sales.length));
    return Array.from({ length: reps }, () => sales).flat();
  }, [sales]);
  const topPrice = useMemo(() => Math.max(0, ...sales.map((s) => s.price)), [sales]);
  const duration = Math.max(group.length * 5, 30);

  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative z-10 flex h-24 items-stretch border-t border-white/10 bg-black/75 backdrop-blur-xl"
    >
      {/* Fixed label */}
      <div className="relative z-10 flex shrink-0 items-center gap-3 border-r border-white/10 bg-black/40 px-6 md:px-10">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sold opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-sold" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-foreground">
            Latest Sales
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {sales.length} {sales.length === 1 ? "player" : "players"} sold
          </p>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="flex flex-1 items-center px-8 text-sm text-muted-foreground">
          No players sold yet — the board updates as results come in.
        </div>
      ) : (
        <div
          className="group relative min-w-0 flex-1 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
          }}
        >
          <div
            className="marquee-track flex h-full w-max items-stretch"
            style={{ animationDuration: `${duration}s` }}
          >
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-stretch">
                {group.map((sale, i) => {
                  const isTop = sale.price === topPrice && topPrice > 0;
                  return (
                    <div
                      key={`${copy}-${sale._id}-${i}`}
                      className="flex shrink-0 items-center gap-4 border-r border-white/10 px-7"
                    >
                      <Avatar
                        className={cn(
                          "size-12 rounded-full ring-2",
                          isTop ? "ring-primary/70" : "ring-white/15"
                        )}
                      >
                        {sale.avatarUrl && (
                          <AvatarImage src={sale.avatarUrl} alt="" className="object-cover" />
                        )}
                        <AvatarFallback className="bg-secondary text-sm font-semibold">
                          {sale.playerName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-[9rem]">
                        <p className="max-w-[12rem] truncate text-base font-semibold leading-tight">
                          {sale.playerName}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar className="size-4 rounded-full">
                            {sale.teamLogoUrl && (
                              <AvatarImage src={sale.teamLogoUrl} alt="" className="object-cover" />
                            )}
                            <AvatarFallback className="bg-secondary text-[7px]">
                              {sale.teamName.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[10rem] truncate">{sale.teamName}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            "tabular-money text-xl font-bold leading-tight",
                            isTop ? "text-primary" : "text-foreground"
                          )}
                        >
                          ₹{sale.price.toLocaleString("en-IN")}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                            isTop ? "text-primary/80" : "text-sold"
                          )}
                        >
                          {isTop ? "Highest sale" : "Sold"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.footer>
  );
}
