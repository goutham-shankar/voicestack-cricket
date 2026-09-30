"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FADE_S = 0.8;

// Drop a web-optimised clip here to use footage instead of the painted backdrop.
const CLIP = "/video/idle-match.mp4";

// Inline SVG noise, used as film grain.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function IdleMatchBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Honour reduced-motion: the CSS kills the pan, this stops the footage too.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const v = videoRef.current;
      if (!v) return;
      if (mq.matches) v.pause();
      else void v.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [ready]);

  // Fade to black just before the loop point and back in after it, hiding the hard cut.
  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const nearEnd = v.duration - v.currentTime < FADE_S;
    setVisible((prev) => (prev === !nearEnd ? prev : !nearEnd));
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black">
      {/* Painted stadium backdrop: covers load, and stands in when there is no clip */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          failed || !ready ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% 118%, oklch(0.42 0.11 150) 0%, transparent 60%)," +
              "radial-gradient(ellipse 60% 40% at 12% -8%, oklch(0.55 0.12 250 / 0.5) 0%, transparent 65%)," +
              "radial-gradient(ellipse 60% 40% at 88% -8%, oklch(0.55 0.12 250 / 0.5) 0%, transparent 65%)," +
              "linear-gradient(180deg, oklch(0.16 0.03 265) 0%, oklch(0.11 0.02 265) 55%, oklch(0.08 0.02 150) 100%)",
          }}
        />
        {/* Floodlight bloom */}
        <div
          className="idle-sweep absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
          style={{ animation: "idle-sweep 18s ease-in-out infinite" }}
        />
      </div>

      {/* Footage, colour-graded and slowly pushed in */}
      {!failed && (
        <video
          ref={videoRef}
          src={CLIP}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => {
            setReady(true);
            setVisible(true);
          }}
          onError={() => setFailed(true)}
          onTimeUpdate={handleTimeUpdate}
          className={cn(
            "idle-kenburns absolute inset-0 size-full object-cover transition-opacity duration-700",
            visible ? "opacity-100" : "opacity-0"
          )}
          style={{
            filter: "saturate(0.8) contrast(1.08) brightness(0.9) blur(1px)",
            animation: "idle-kenburns 40s ease-in-out infinite alternate",
          }}
        />
      )}

      {/* Cool brand tint to unify the footage with the UI */}
      <div className="absolute inset-0 bg-primary/10 mix-blend-color" />
      <div className="absolute inset-0 bg-black/20" />

      {/* Spotlight: keep the centre readable, deepen the edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Header and ticker legibility */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />

      {/* Slow light sweep */}
      <div
        className="idle-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.045] to-transparent"
        style={{ animation: "idle-sweep 14s ease-in-out infinite" }}
      />

      {/* Scanlines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {/* Inner frame */}
      <div className="absolute inset-3 rounded-2xl ring-1 ring-inset ring-white/[0.06] md:inset-5" />
    </div>
  );
}
