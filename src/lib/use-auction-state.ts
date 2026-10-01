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

function playerId(state: FullAuctionState): string | null {
  const player = state.auctionState.currentPlayerId;
  return player ? String(player._id) : null;
}

/**
 * Derive the sold/unsold results that a socket would have pushed, by comparing
 * two polled snapshots. `recentSales[]._id` is the player id, so a sale that is
 * new to the latest snapshot means that player was just sold; a player that was
 * live and left the block without appearing in the sales feed went unsold.
 */
function diffResults(
  prev: FullAuctionState,
  next: FullAuctionState,
): AuctionResult[] {
  const seen = new Set(prev.recentSales.map((sale) => sale._id));
  const results: AuctionResult[] = next.recentSales
    .filter((sale) => !seen.has(sale._id))
    .reverse()
    .map((sale) => ({
      status: "SOLD" as const,
      playerName: sale.playerName,
      playerAvatarUrl: sale.avatarUrl,
      teamName: sale.teamName,
      price: sale.price,
    }));

  const wasLive = prev.auctionState.currentPlayerId;
  if (wasLive) {
    const leftTheBlock = playerId(next) !== String(wasLive._id);
    const sold = next.recentSales.some(
      (sale) => sale._id === String(wasLive._id),
    );
    if (leftTheBlock && !sold) {
      results.push({ status: "UNSOLD", playerName: wasLive.name });
    }
  }

  return results;
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

  return { state, connected };
}
