"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuctionState } from "@/lib/use-auction-state";
import { IdleMatchBackground } from "@/components/auction/idle-match-background";
import { BroadcastHeader, VideoScrim } from "@/components/auction/display/broadcast-header";
import {
  PlayerIdentity,
  PlayerPortrait,
} from "@/components/auction/display/player-stage";
import { BidRail, type BidEntry } from "@/components/auction/display/bid-rail";
import { WaitingStage } from "@/components/auction/display/waiting-stage";
import { ShowcaseStage } from "@/components/auction/display/showcase-stage";
import { StatsStrip, SalesTicker } from "@/components/auction/display/bottom-bar";
import { ResultOverlay } from "@/components/auction/display/result-overlay";
import { RoundBanner } from "@/components/auction/display/round-banner";
import { useAuctionPhase, PHASE_META } from "@/lib/auction-phase";
import { BrandLogo } from "@/components/brand-logo";
import { Volume2 } from "lucide-react";
import type { AuctionResult, CategoryRef } from "@/lib/auction-types";


/** Rounds worth announcing. The general round needs no introduction. */
const ANNOUNCED_ROUNDS = new Set(["specialist", "power player"]);

const BANNER_MS = 7000;

/**
 * The round the board has just moved into, while it is worth announcing.
 *
 * Only a change counts. A projector that joins part-way through a round has
 * missed the announcement and should not replay it, so the first reading of
 * the state records where the board already is and announces nothing.
 */
function useRoundAnnouncement(
  currentCategoryId: string | null,
  categories: CategoryRef[]
): CategoryRef | null {
  const [announced, setAnnounced] = useState<CategoryRef | null>(null);
  // Undefined until the first reading, which is how "joined mid-round" is told
  // apart from "the admin just changed the round".
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  // Adjusting state during render rather than in an effect: the banner is a
  // function of the round having changed, so deriving it here avoids a frame
  // where the new round is on screen without its announcement.
  if (seen !== currentCategoryId) {
    setSeen(currentCategoryId);
    if (seen !== undefined) {
      const round = categories.find((c) => c._id === currentCategoryId);
      setAnnounced(
        round && ANNOUNCED_ROUNDS.has(round.name.trim().toLowerCase())
          ? round
          : null
      );
    }
  }

  // Dismissal is its own effect, so a re-render while the banner is up cannot
  // clear the timer and leave it on screen for good.
  useEffect(() => {
    if (!announced) return;
    const timer = setTimeout(() => setAnnounced(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [announced]);

  return announced;
}


export default function DisplayPage() {
  const [flash, setFlash] = useState<AuctionResult | null>(null);
  const [soundReady, setSoundReady] = useState(false);
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

  // Try to unlock audio with no interaction at all. This succeeds when Chrome
  // is launched with --autoplay-policy=no-user-gesture-required (the projector
  // setup) or when the site has earned enough media engagement. If the browser
  // refuses, the Enable Sound button below is the fallback.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        setSoundReady(true);
      })
      .catch(() => {});
  }, []);

  // Any user gesture also counts, so keep listening globally.
  useEffect(() => {
    function primeAudio() {
      const audio = audioRef.current;
      if (!audio) return;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          setSoundReady(true);
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

  return (
    <div className="broadcast dark relative flex h-svh flex-col overflow-hidden bg-black text-white">
      <audio ref={audioRef} src="/audio/ipl-theme.mp3" playsInline />
      <IdleMatchBackground />
      {!soundReady && (
        <button
          type="button"
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            void audio
              .play()
              .then(() => {
                audio.pause();
                audio.currentTime = 0;
                setSoundReady(true);
              })
              .catch(() => {});
          }}
          className="absolute bottom-5 right-5 z-50 flex items-center gap-2 rounded-sm bg-white/12 px-4 py-2.5 text-xs font-black uppercase tracking-[0.24em] text-white/90 backdrop-blur-md transition hover:bg-white/20"
        >
          <Volume2 className="size-4" />
          Enable Sound
        </button>
      )}
      {state ? <Board state={state} flash={flash} /> : <Connecting />}
    </div>
  );
}

function Connecting() {
  return (
    <>
      <VideoScrim />
      <div className="relative z-20 flex flex-1 flex-col items-center justify-center gap-6">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandLogo size={84} className="rounded-2xl ring-1 ring-white/15" />
        </motion.div>
        <p className="text-base font-black uppercase tracking-[0.42em] text-white/78">
          Connecting to auction
        </p>
      </div>
    </>
  );
}

function Board({
  state,
  flash,
}: {
  state: NonNullable<ReturnType<typeof useAuctionState>["state"]>;
  flash: AuctionResult | null;
}) {
  const { auctionState, stats, recentSales } = state;
  const player = auctionState.currentPlayerId;

  const announcedRound = useRoundAnnouncement(
    auctionState.currentCategoryId,
    state.categories
  );

  const showcase = auctionState.showcase === true;
  const phase = useAuctionPhase(auctionState, flash);
  const urgent = PHASE_META[phase].urgent ?? false;

  const basePrice = player
    ? (player.basePriceOverride ?? player.categoryId?.defaultBasePrice ?? 0)
    : 0;

  /**
   * Bids on the current lot, newest first, with each bidder's crest resolved
   * from the live team list. This drives the CURRENT BID figure, the
   * highest-bidder panel and the recent-bids list; an empty list leaves the
   * rail on the opening price and its explicit "awaiting first bid" state.
   */
  const liveBids = useMemo<BidEntry[]>(() => {
    const teamsById = new Map(state.teams.map((t) => [t._id, t]));
    return [...auctionState.bids]
      .reverse()
      .map((bid, index) => {
        const team = teamsById.get(bid.teamId);
        return {
          id: `${bid.teamId}-${bid.amount}-${index}`,
          amount: bid.amount,
          teamName: team?.name ?? "Unknown team",
          teamLogoUrl: team?.logoUrl ?? null,
        };
      });
  }, [auctionState.bids, state.teams]);

  // AuctionResult carries only the team name, so resolve the crest and the
  // post-purchase wallet from the live team list.
  const winningTeam = useMemo(() => {
    if (flash?.status !== "SOLD") return null;
    const t = state.teams.find((x) => x.name === flash.teamName);
    return {
      name: flash.teamName,
      logoUrl: t?.logoUrl ?? null,
      squadCount: t?.squadCount ?? 0,
      maxSquadSize: t?.maxSquadSize ?? null,
      remaining: t?.remaining ?? 0,
    };
  }, [flash, state.teams]);

  return (
    <>
      <VideoScrim urgent={urgent} />

      <BroadcastHeader isLive={auctionState.status === "LIVE"} />

      {/* Stage */}
      <main className="relative z-20 flex min-h-0 flex-1 items-center px-8 py-6 xl:px-14">
        <AnimatePresence mode="wait">
          {showcase ? (
            <motion.div
              key="showcase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="w-full"
            >
              <ShowcaseStage />
            </motion.div>
          ) : player ? (
            <motion.div
              key={player._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-8 xl:gap-12"
            >
              <PlayerIdentity player={player} phase={phase} />
              <PlayerPortrait player={player} phase={phase} />
              <BidRail
                phase={phase}
                bids={liveBids}
                basePrice={basePrice}
                soldPrice={flash?.status === "SOLD" ? flash.price : null}
                soldTeam={winningTeam}
              />
            </motion.div>
          ) : (
            <WaitingStage key="waiting" stats={stats} sales={recentSales} />
          )}
        </AnimatePresence>
      </main>

      <div className="relative z-20">
        <StatsStrip stats={stats} />
        <SalesTicker sales={recentSales} />
      </div>

      <AnimatePresence>
        {announcedRound && (
          <RoundBanner key={`round-${announcedRound._id}`} round={announcedRound} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flash && (
          <ResultOverlay
            key={`${flash.status}-${flash.playerName}`}
            result={flash}
            team={winningTeam}
          />
        )}
      </AnimatePresence>
    </>
  );
}
