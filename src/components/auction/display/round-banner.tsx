"use client";

import { motion } from "framer-motion";
import { fmt } from "@/lib/auction-engine";
import type { CategoryRef } from "@/lib/auction-types";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Full-stage announcement when the admin opens a special round.
 *
 * The specialist and power-player rounds change what the money means — the
 * base price jumps and fresh purse is released — so the room is told plainly
 * before the first lot of that round comes up, rather than being left to infer
 * it from a price that suddenly looks wrong.
 */
export function RoundBanner({ round }: { round: CategoryRef }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 60% at 50% 50%, color-mix(in oklch, var(--gold) 22%, transparent), transparent 70%)",
        }}
      />

      {/* The same wipe the result overlay uses, so the two read as one system. */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 left-0 w-full bg-gold/25"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 0] }}
        transition={{ duration: 0.9, times: [0, 0.45, 1], ease: EASE }}
        style={{ transformOrigin: "left" }}
      />

      <div className="relative flex flex-col items-center px-12 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className="text-[0.7rem] font-black uppercase tracking-[0.46em] text-white/70 xl:text-xs"
        >
          Next Round
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.4 }}
          className="mt-4 font-black uppercase leading-[0.9] tracking-tighter text-white"
          style={{
            fontSize: "clamp(3rem, 9vw, 9rem)",
            textShadow: "0 0 90px color-mix(in oklch, var(--gold) 40%, transparent)",
          }}
        >
          {round.name}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.62 }}
          className="mt-7 flex items-center gap-5"
        >
          <span aria-hidden className="h-px w-16 bg-white/25" />
          <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/72 xl:text-[0.72rem]">
            Base{" "}
            <span className="tabular-money text-gold">
              {fmt(round.defaultBasePrice)}
            </span>
          </p>
          <span aria-hidden className="h-px w-16 bg-white/25" />
        </motion.div>
      </div>
    </motion.div>
  );
}
