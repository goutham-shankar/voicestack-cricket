"use client";

import { fmt } from "@/lib/auction-engine";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, animate } from "framer-motion";
import { cn } from "@/lib/utils";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
/** Cap turns so the strip never scrolls past painted digits (blank = invisible). */
const MAX_TURNS = 4;
const REEL = Array.from({ length: (MAX_TURNS + 1) * 10 }, (_, i) => DIGITS[i % 10]);

type Phase = "idle" | "delta" | "roll" | "final";

const DELTA_MS = 650;
const ROLL_MS = 2200;
const FINAL_MS = 400;

function digitOnly(amount: number) {
  return Math.floor(Math.abs(amount)).toString();
}

function CasinoDigit({
  digit,
  fromDigit,
  digitHeight,
  shouldSpin,
  spinKey,
}: {
  digit: string;
  fromDigit: string;
  digitHeight: number;
  shouldSpin: boolean;
  spinKey: number;
}) {
  const targetIndex = Math.max(0, DIGITS.indexOf(digit as (typeof DIGITS)[number]));
  const fromIndex = Math.max(0, DIGITS.indexOf(fromDigit as (typeof DIGITS)[number]));
  const y = useMotionValue(0);
  const ready = digitHeight > 0;
  // Prefer measured px; fall back to 1em so the window is never empty/clipped.
  const cell = digitHeight > 0 ? digitHeight : undefined;

  useLayoutEffect(() => {
    if (!ready) return;
    // Always park on a real glyph before paint — never leave y at 0 (blank gap).
    y.set(-(shouldSpin ? fromIndex : targetIndex) * digitHeight);
  }, [ready, digitHeight, targetIndex, fromIndex, shouldSpin, y]);

  useEffect(() => {
    if (!ready || !shouldSpin) return;

    // Farther digit changes get more turns; always ease fast → slow into the stop.
    const gap = (targetIndex - fromIndex + 10) % 10 || 10;
    const turns = Math.min(2 + Math.floor(gap / 3), MAX_TURNS);
    const landAt = turns * 10 + targetIndex; // always < REEL.length
    const duration = 0.85 + turns * 0.2 + gap * 0.03;

    y.set(-fromIndex * digitHeight);

    const controls = animate(y, -landAt * digitHeight, {
      type: "tween",
      duration,
      // Strong ease-out: quick while far, settles slowly when near.
      ease: [0.05, 0.85, 0.1, 1],
      onComplete: () => {
        y.set(-targetIndex * digitHeight);
      },
    });

    return () => controls.stop();
  }, [shouldSpin, spinKey, targetIndex, fromIndex, digitHeight, y, ready]);

  return (
    <span
      className="relative inline-block overflow-hidden align-bottom leading-none"
      style={{ height: cell ?? "1em", width: "0.68em" }}
    >
      {ready ? (
        <motion.div
          className="absolute left-0 top-0 w-full will-change-transform"
          style={{ y }}
        >
          {REEL.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="flex w-full items-center justify-center leading-none"
              style={{ height: digitHeight }}
            >
              {d}
            </div>
          ))}
        </motion.div>
      ) : (
        <span className="flex h-full w-full items-center justify-center leading-none">
          {digit}
        </span>
      )}
    </span>
  );
}

function CasinoNumber({
  value,
  fromAmount,
  spinning,
  spinKey,
}: {
  value: string;
  fromAmount: number;
  spinning: boolean;
  spinKey: number;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [digitHeight, setDigitHeight] = useState(0);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const update = () => {
      const h = el.offsetHeight;
      if (h > 0) setDigitHeight(h);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  const toDigits = value.replace(/\D/g, "");
  const fromDigits = digitOnly(fromAmount).padStart(toDigits.length, "0");
  // First digit (from the left) that differs — spin that column and everything
  // to its right (e.g. 9000→9500 spins "000"→"500", leaves "9" still).
  let firstChanged = toDigits.length;
  for (let i = 0; i < toDigits.length; i++) {
    if (fromDigits[i] !== toDigits[i]) {
      firstChanged = i;
      break;
    }
  }
  const chars = value.split("");
  const digitIndexAt: number[] = [];
  for (let i = 0, pos = 0; i < chars.length; i++) {
    if (chars[i] >= "0" && chars[i] <= "9") {
      digitIndexAt.push(pos);
      pos += 1;
    } else {
      digitIndexAt.push(-1);
    }
  }

  return (
    <span className="relative inline-flex items-center leading-none" aria-label={value}>
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-pre leading-none"
        style={{ visibility: "hidden" }}
      >
        0
      </span>

      {chars.map((char, i) => {
        const fromRight = chars.length - 1 - i;
        if (char >= "0" && char <= "9") {
          const pos = digitIndexAt[i];
          const fromDigit = fromDigits[pos] ?? "0";
          const shouldSpin =
            spinning && firstChanged < toDigits.length && pos >= firstChanged;
          return (
            <CasinoDigit
              key={`digit-r${fromRight}`}
              digit={char}
              fromDigit={fromDigit}
              digitHeight={digitHeight}
              shouldSpin={shouldSpin}
              spinKey={spinKey}
            />
          );
        }
        return (
          <span
            key={`sep-r${fromRight}`}
            className="inline-flex items-center justify-center leading-none"
            style={{
              height: digitHeight || undefined,
              width: char === "," ? "0.28em" : "0.36em",
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

export function MoneyFigure({
  amount,
  fromAmount,
  className,
  style,
  casino = false,
  spinning = false,
  spinKey = 0,
}: {
  amount: number;
  fromAmount?: number;
  className?: string;
  style?: React.CSSProperties;
  casino?: boolean;
  spinning?: boolean;
  spinKey?: number;
}) {
  const formatted = fmt(amount);
  return (
    <span
      className={cn("inline-flex items-center font-black tracking-tight", className)}
      style={style}
    >
      {casino ? (
        <CasinoNumber
          value={formatted}
          fromAmount={fromAmount ?? amount}
          spinning={spinning}
          spinKey={spinKey}
        />
      ) : (
        <span className="leading-none tabular-money">{formatted}</span>
      )}
    </span>
  );
}

export function AnimatedBidAmount({
  amount,
  className,
  size = "md",
  label,
}: {
  amount: number;
  className?: string;
  size?: "md" | "lg";
  label?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [shownAmount, setShownAmount] = useState(amount);
  const [holdAmount, setHoldAmount] = useState(amount);
  const [delta, setDelta] = useState<number | null>(null);
  const [seqId, setSeqId] = useState(0);

  const targetRef = useRef(amount);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (amount === targetRef.current) return;

    if (amount < targetRef.current) {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      targetRef.current = amount;
      setShownAmount(amount);
      setHoldAmount(amount);
      setDelta(null);
      setPhase("idle");
      return;
    }

    const from = targetRef.current;
    const hike = amount - from;
    const id = Date.now();
    targetRef.current = amount;

    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    setSeqId(id);
    setDelta(hike);
    setHoldAmount(from);
    setShownAmount(amount);
    setPhase("delta");

    timersRef.current = [
      window.setTimeout(() => setPhase("roll"), DELTA_MS),
      window.setTimeout(() => {
        setPhase("final");
        setDelta(null);
        setHoldAmount(amount);
      }, DELTA_MS + ROLL_MS),
      window.setTimeout(() => setPhase("idle"), DELTA_MS + ROLL_MS + FINAL_MS),
    ];
  }, [amount]);

  const large = size === "lg";
  // Fluid, viewport-relative sizing so big crore-scale figures never clip the
  // layout on narrower screens — shrink the vw factor as digit count grows.
  const digitCount = digitOnly(shownAmount).length;
  const largeVw = digitCount > 8 ? 4.4 : digitCount > 6 ? 5.2 : 6;
  const priceStyle: React.CSSProperties | undefined = large
    ? { fontSize: `clamp(2.25rem, ${largeVw}vw, 6.5rem)` }
    : undefined;
  const deltaSize = large ? "text-xl sm:text-2xl" : "text-sm";

  const showDelta = phase === "delta" || phase === "roll";
  const holding = phase === "delta";
  const greenPrice = phase === "roll" || phase === "final";
  const spinning = phase === "roll";

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        large ? "items-stretch" : "items-center",
        className
      )}
      aria-label={`${fmt(amount)}`}
    >
      <div
        className={cn(
          "flex w-full items-center gap-3",
          label ? "justify-between" : "justify-end",
          !large && !label && "justify-center",
          large ? "min-h-8" : "min-h-6"
        )}
      >
        {label && (
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
        )}

        <div className="flex min-h-[1.25em] min-w-[4.5rem] items-center justify-end">
          <AnimatePresence mode="popLayout">
            {showDelta && delta != null && (
              <motion.span
                key={`delta-${seqId}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                className={cn("font-bold tabular-money text-sold", deltaSize)}
              >
                +{fmt(delta)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={cn("relative mt-2 w-full", !large && "mt-1 flex justify-center")}>
        <div className={cn(holding ? "opacity-0" : "opacity-100")} aria-hidden={holding}>
          <MoneyFigure
            amount={shownAmount}
            fromAmount={holdAmount}
            casino
            spinning={spinning}
            spinKey={seqId}
            style={priceStyle}
            className={cn(
              !large && "text-2xl",
              "transition-colors duration-300",
              greenPrice ? "text-sold" : "text-primary"
            )}
          />
        </div>

        {holding && (
          <div className={cn("absolute inset-0", !large && "flex justify-center")}>
            <MoneyFigure
              amount={holdAmount}
              style={priceStyle}
              className={cn(!large && "text-2xl", "text-primary")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
