"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSocket,
  isRealtimeUnavailable,
  onRealtimeAvailabilityChange,
} from "@/lib/socket-client";
import type { AuctionResult, FullAuctionState } from "@/lib/auction-types";

// How often we re-fetch state when sockets are unavailable (serverless hosts).
// /api/auction/state also resolves expired lots, so polling keeps the timer
// honest the same way a socket broadcast would. A backgrounded tab backs off
// instead of stopping, so it is never more than one interval out of date.
const POLL_INTERVAL_MS = 1500;
const HIDDEN_POLL_INTERVAL_MS = 10000;

async function fetchAuctionState(): Promise<FullAuctionState | null> {
  const res = await fetch("/api/auction/state", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Derive the sold/unsold result that a socket would have pushed, by reading the
 * settled-lot record the server stamps on every sale. Its `key` changes once
 * per result, so comparing keys fires each overlay exactly once — and a snapshot
 * that merely gained a bid produces no result at all.
 */
function diffResults(
  prev: FullAuctionState,
  next: FullAuctionState,
): AuctionResult[] {
  const settled = next.auctionState.lastResult;
  if (!settled) return [];
  if (prev.auctionState.lastResult?.key === settled.key) return [];

  if (settled.kind === "SOLD") {
    const sale = next.recentSales.find((item) => item._id === settled.playerId);
    return [
      {
        status: "SOLD",
        playerName: settled.playerName,
        playerAvatarUrl: sale?.avatarUrl ?? null,
        teamName: settled.teamName ?? "Unknown team",
        price: settled.amount ?? 0,
      },
    ];
  }
  return [{ status: "UNSOLD", playerName: settled.playerName }];
}

export function useAuctionState({
  onSold,
  onUnsold,
}: {
  onSold?: (result: Extract<AuctionResult, { status: "SOLD" }>) => void;
  onUnsold?: (result: Extract<AuctionResult, { status: "UNSOLD" }>) => void;
} = {}) {
  const [state, setState] = useState<FullAuctionState | null>(null);
  const [connected, setConnected] = useState(() => getSocket().connected);
  const [polling, setPolling] = useState(() => isRealtimeUnavailable());
  const onSoldRef = useRef(onSold);
  const onUnsoldRef = useRef(onUnsold);
  const latestRef = useRef<FullAuctionState | null>(null);

  useEffect(() => {
    onSoldRef.current = onSold;
    onUnsoldRef.current = onUnsold;
  }, [onSold, onUnsold]);

  // Applies a freshly fetched snapshot and fires the overlay callbacks for
  // anything that changed since the previous one.
  const applyPolled = useCallback((next: FullAuctionState) => {
    const prev = latestRef.current;
    latestRef.current = next;
    setState(next);
    if (!prev) return;
    for (const result of diffResults(prev, next)) {
      if (result.status === "SOLD") onSoldRef.current?.(result);
      else onUnsoldRef.current?.(result);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const socket = getSocket();

    function handleState(data: FullAuctionState) {
      latestRef.current = data;
      setState(data);
    }
    function handleSold(result: Extract<AuctionResult, { status: "SOLD" }>) {
      onSoldRef.current?.(result);
    }
    function handleUnsold(result: Extract<AuctionResult, { status: "UNSOLD" }>) {
      onUnsoldRef.current?.(result);
    }
    function handleConnect() {
      setConnected(true);
      setPolling(false);
      fetchAuctionState().then((data) => {
        if (!cancelled && data) handleState(data);
      });
    }
    function handleDisconnect() {
      setConnected(false);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("auction:state", handleState);
    socket.on("auction:sold", handleSold);
    socket.on("auction:unsold", handleUnsold);

    const stopWatching = onRealtimeAvailabilityChange(() => {
      if (!cancelled) setPolling(isRealtimeUnavailable());
    });

    fetchAuctionState().then((data) => {
      if (!cancelled && data) handleState(data);
    });

    return () => {
      cancelled = true;
      stopWatching();
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("auction:state", handleState);
      socket.off("auction:sold", handleSold);
      socket.off("auction:unsold", handleUnsold);
    };
  }, []);

  // Polling fallback: runs only once sockets have been ruled out, so the
  // socket-served deployment keeps its push-only behaviour.
  useEffect(() => {
    if (!polling) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;

    async function tick() {
      clearTimeout(timer);
      if (!inFlight) {
        inFlight = true;
        try {
          const data = await fetchAuctionState();
          if (cancelled) return;
          if (data) {
            applyPolled(data);
            setConnected(true);
          } else {
            setConnected(false);
          }
        } catch {
          if (!cancelled) setConnected(false);
        } finally {
          inFlight = false;
        }
      }
      if (!cancelled) {
        timer = setTimeout(
          tick,
          document.hidden ? HIDDEN_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
        );
      }
    }

    function handleVisibility() {
      if (!document.hidden) tick();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [polling, applyPolled]);

  /**
   * Adopt a state that an action just returned, instead of waiting for the
   * broadcast or the next poll. Routes answer with the whole state, so this is
   * authoritative — and it keeps the board responsive on hosts where sockets
   * are unavailable. Result overlays still fire, keyed off `lastResult`.
   */
  const apply = useCallback(
    (next: FullAuctionState) => {
      applyPolled(next);
    },
    [applyPolled]
  );

  return { state, connected, apply };
}
