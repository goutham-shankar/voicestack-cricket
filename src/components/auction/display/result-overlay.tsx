"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AuctionResult } from "@/lib/auction-types";
import { compactMoney } from "@/lib/auction-phase";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Reveals a word letter by letter — each glyph springs up out of a blur. */
function RevealWord({
  word,
  className,
  style,
  delay = 0,
}: {
  word: string;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  return (
    <span className={className} style={style}>
      {word.split("").map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: "0.45em", scale: 1.6, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{
            delay: delay + i * 0.075,
            duration: 0.62,
            ease: EASE,
          }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/** Rolls the figure up to the hammer price instead of just appearing. */
function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const DURATION = 1100;
    const startTimer = window.setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const t = Math.min(1, (ts - start) / DURATION);
        // easeOutExpo — fast climb, soft landing on the final figure.
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setValue(Math.round(to * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      window.clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [to, delay]);

  return <>{compactMoney(value)}</>;
}

export type WinningTeam = {
  name: string;
  logoUrl: string | null;
  squadCount: number;
  maxSquadSize: number;
  remaining: number;
};

/**
 * Full-stage confirmation once a lot closes: who got the player, for how much,
 * and what it leaves them with. Restrained motion — a wipe and a scale-in, no
 * confetti — but the numbers are sized to carry a room.
 */
export function ResultOverlay({
  result,
  team,
}: {
  result: AuctionResult;
  team: WinningTeam | null;
}) {
  const sold = result.status === "SOLD";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-black/88 backdrop-blur-xl" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: sold
            ? "radial-gradient(ellipse 65% 60% at 50% 50%, color-mix(in oklch, var(--sold) 24%, transparent), transparent 70%)"
            : "radial-gradient(ellipse 65% 60% at 50% 50%, rgba(255,255,255,0.05), transparent 70%)",
        }}
      />

      {/* Wipe that reveals the verdict */}
      <motion.div
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-full", sold ? "bg-sold" : "bg-white/12")}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 0] }}
        transition={{ duration: 0.85, times: [0, 0.45, 1], ease: EASE }}
        style={{ transformOrigin: "left" }}
      />

      <div className="relative flex flex-col items-center px-12 text-center">
        <div className="relative">
          <RevealWord
            word={sold ? "SOLD" : "UNSOLD"}
            delay={0.22}
            className={cn(
              "block font-black uppercase leading-[0.82] tracking-tighter",
              sold ? "text-sold" : "text-white/60"
            )}
            style={{
              fontSize: "clamp(4rem, 11vw, 11rem)",
              textShadow: sold
                ? "0 0 90px color-mix(in oklch, var(--sold) 45%, transparent)"
                : undefined,
            }}
          />
          {/* Light sweep across the word once it has landed */}
          {sold && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.75) 50%, transparent 62%)",
                mixBlendMode: "overlay",
              }}
              initial={{ x: "-120%" }}
              animate={{ x: "120%" }}
              transition={{ delay: 0.75, duration: 0.85, ease: "easeInOut" }}
            />
          )}
        </div>

        {sold && team ? (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-10 xl:gap-16"
          >
            {/* Player */}
            <div className="flex items-center gap-5">
              <Avatar className="size-36 rounded-sm ring-1 ring-white/25 xl:size-44">
                {result.playerAvatarUrl && (
                  <AvatarImage src={result.playerAvatarUrl} alt="" className="object-cover" />
                )}
                <AvatarFallback className="rounded-sm bg-white/10 text-4xl font-black text-white">
                  {result.playerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p
                className="max-w-[16rem] text-left font-black leading-[0.95] tracking-tight text-white"
                style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)", overflowWrap: "anywhere" }}
              >
                {result.playerName}
              </p>
            </div>

            <span aria-hidden className="h-24 w-px shrink-0 bg-white/20" />

            {/* Hammer price */}
            <motion.div
              initial={{ opacity: 0, scale: 1.18 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.78 }}
              className="shrink-0"
            >
              <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/68">
                Sold For
              </p>
              <p
                className="tabular-money mt-1.5 whitespace-nowrap font-black leading-none tracking-tighter text-gold"
                style={{
                  fontSize: "clamp(2.75rem, 6.5vw, 6.5rem)",
                  textShadow: "0 0 80px color-mix(in oklch, var(--gold) 45%, transparent)",
                }}
              >
                <CountUp to={result.price} delay={0.85} />
              </p>
            </motion.div>

            <span aria-hidden className="h-24 w-px shrink-0 bg-white/20" />

            {/* Winning team */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.95 }}
              className="flex items-center gap-5"
            >
              <Avatar className="size-32 rounded-full ring-4 ring-sold/70 xl:size-40">
                {team.logoUrl && (
                  <AvatarImage src={team.logoUrl} alt="" className="object-cover" />
                )}
                <AvatarFallback className="bg-white/10 text-4xl font-black text-white">
                  {team.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/68">
                  Winning Team
                </p>
                <p
                  className="mt-1.5 max-w-[16rem] font-black leading-[0.95] tracking-tight text-white"
                  style={{ fontSize: "clamp(1.75rem, 3.2vw, 3rem)" }}
                >
                  {team.name}
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : sold ? (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="tabular-money mt-6 font-black tracking-tighter text-gold"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5.5rem)" }}
          >
            {result.playerName} — {compactMoney(result.price)}
          </motion.p>
        ) : (
          <>
            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
              className="mt-2 font-black tracking-tight text-white"
              style={{ fontSize: "clamp(2rem, 4vw, 3.75rem)" }}
            >
              {result.playerName}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-5 text-2xl font-semibold text-white/55"
            >
              No bids received — returns to the pool.
            </motion.p>
          </>
        )}
      </div>
    </motion.div>
  );
}
