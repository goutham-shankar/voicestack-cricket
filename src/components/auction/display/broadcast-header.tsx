"use client";

import { motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export function BroadcastHeader({ isLive }: { isLive: boolean }) {
  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between gap-6 px-8 pt-6 xl:px-14 xl:pt-8">
      <div className="flex items-center gap-4">
        <BrandLogo size={52} className="rounded-xl ring-1 ring-white/15" />
        <div className="leading-none">
          <p className="text-xl font-black uppercase tracking-tight text-white xl:text-2xl">
            Voicestack Cricket League
          </p>
          <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.42em] text-primary">
            Live Auction
          </p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-sm px-4 py-2.5",
          isLive ? "bg-live" : "bg-white/10"
        )}
      >
        {isLive && (
          <motion.span
            className="size-2.5 rounded-full bg-white"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span className="text-sm font-black uppercase tracking-[0.28em] text-white">
          {isLive ? "Live" : "Paused"}
        </span>
      </div>
    </header>
  );
}

/**
 * Cinematic treatment laid over the match footage: vignette, heavy bottom
 * ramp for the stats bar, and a fine grid. Tuned so large type stays legible
 * from across a room without hiding the video entirely.
 */
export function VideoScrim({ urgent }: { urgent?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      {/* Light overall knock-down only — the footage must stay legible on a
          projector, which already lifts blacks and loses contrast. */}
      <div className="absolute inset-0 bg-black/26" />

      {/* Text sits on decisive ramps rather than a global dim. Projectors
          render soft low-alpha gradients poorly, so these are deliberately
          strong and tightly scoped to the copy. */}
      <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-black/92 via-black/62 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[40%] bg-gradient-to-l from-black/82 via-black/48 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/92 via-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-black via-black/85 to-transparent" />

      {/* Gentle vignette to frame the picture without crushing the middle */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 82% 72% at 50% 44%, transparent 0%, transparent 46%, rgba(0,0,0,0.42) 100%)",
        }}
      />

      {/* Grid texture */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* Urgency wash during the going-once / going-twice calls */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 100%, color-mix(in oklch, var(--gold) 26%, transparent), transparent 65%)",
        }}
        animate={{ opacity: urgent ? [0, 0.8, 0] : 0 }}
        transition={{ duration: 1.1, repeat: urgent ? Infinity : 0, ease: "easeInOut" }}
      />
    </div>
  );
}
