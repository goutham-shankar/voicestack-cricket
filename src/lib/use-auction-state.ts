"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getSocket,
  isRealtimeUnavailable,
  onRealtimeAvailabilityChange,
} from "@/lib/socket-client";
import type { AuctionResult, FullAuctionState } from "@/lib/auction-types";

// How often we check for changes when sockets are unavailable (serverless
// hosts). A backgrounded tab backs off instead of stopping, so it is never
// more than one interval out of date.
const POLL_INTERVAL_MS = 1500;
const HIDDEN_POLL_INTERVAL_MS = 10000;

/**
 * Most polls find nothing has changed, and the full board is built from every
 * collection. So each tick asks for a one-document change signature first and
 * only pulls the board when it moves — far less work per idle tick, at the same
 * responsiveness.
 *
 * Edits made outside the auction (an admin renaming a player) do not move the
 * signature, so the board is also refreshed in full on this slower timer.
 */
const FULL_REFRESH_EVERY_MS = 60000;

/**
 * Is this payload a board the components can actually render?
 *
 * Snapshots arrive from two places, and only one of them is a response we just
 * asked for. The relay replays its last cached `auction:state` to every client
 * the moment it connects, so a payload can predate the running build — the
 * tunnel in front of the relay drops regularly, and each reconnect replays
 * again. The board reads `settings`, `teams[].board` and `categories` without
 * guarding every access, so a snapshot missing them throws during render, and
 * a render throw takes the whole page down rather than one panel.
 *
 * Checking the shape at the boundary is cheaper than guarding every read, and
 * it fails in the one place that can do something sensible about it: drop the
 * payload and keep the state we already had.
 */
function isRenderableState(data: unknown): data is FullAuctionState {
  if (!data || typeof data !== "object") return false;
  const state = data as Partial<FullAuctionState>;
  return (
    Boolean(state.auctionState) &&
    typeof state.auctionState?.status === "string" &&
    Boolean(state.settings) &&
    typeof state.settings?.bidIncrement === "number" &&
    Array.isArray(state.teams) &&
    Array.isArray(state.categories) &&
    Array.isArray(state.pendingPlayers) &&
    Array.isArray(state.recentSales) &&
    // Added with the power-player round. A relay replaying a payload from an
    // older build would otherwise reach the board without it and throw.
    Boolean(state.auctionState?.powerRound) &&
    Array.isArray(state.powerPlayers)
  );
}

async function fetchAuctionState(): Promise<FullAuctionState | null> {
  const res = await fetch("/api/auction/state", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return isRenderableState(data) ? data : null;
}

async function fetchStateVersion(): Promise<string | null> {
  const res = await fetch("/api/auction/version", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { version?: string };
  return data.version ?? null;
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

/** `useSyncExternalStore` subscriber for the socket's own connection state. */
function subscribeToSocket(onChange: () => void) {
  const socket = getSocket();
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
  };
}

const getSocketConnected = () => getSocket().connected;

/**
 * The server has no socket, and the browser's first render has not connected
 * one yet, so both sides agree on `false` and hydration is quiet.
 */
const notConnectedOnServer = () => false;

export function useAuctionState({
  onSold,
  onUnsold,
}: {
  onSold?: (result: Extract<AuctionResult, { status: "SOLD" }>) => void;
  onUnsold?: (result: Extract<AuctionResult, { status: "UNSOLD" }>) => void;
} = {}) {
  const [state, setState] = useState<FullAuctionState | null>(null);

  /**
   * Both of these read a system that lives outside React, and both used to be
   * `useState` initialisers. That ran them during the server render as well,
   * where `getSocket()` is not a question but an action: it constructs a
   * Socket.IO client and starts dialling, leaving every rendering lambda on a
   * serverless host holding a socket that retries the relay forever.
   *
   * `useSyncExternalStore` gets this right in both directions — the server
   * snapshot never touches the socket, and a remount onto an already-open one
   * reads as connected without a synchronous setState in an effect.
   */
  const socketConnected = useSyncExternalStore(
    subscribeToSocket,
    getSocketConnected,
    notConnectedOnServer
  );
  const polling = useSyncExternalStore(
    onRealtimeAvailabilityChange,
    isRealtimeUnavailable,
    notConnectedOnServer
  );
  /** Whether the most recent poll reached the server. Only read while polling. */
  const [pollOk, setPollOk] = useState(true);
  const connected = polling ? pollOk : socketConnected;

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

    /**
     * The relay hands every client the last payload it saw for each event the
     * instant that client connects, so a projector waking up is not stuck on a
     * blank board. That replay is not news: it can be older than the snapshot
     * already on screen, and it repeats a sale announced minutes ago. Because
     * connecting also triggers the authoritative fetch in `handleConnect`,
     * nothing from the socket is trusted until that fetch lands.
     *
     * The tunnel in front of the relay drops regularly, so this runs on every
     * reconnect, not only the first connect.
     */
    let replaying = false;

    function handleState(data: unknown) {
      if (!isRenderableState(data)) {
        console.warn("Ignored an auction:state payload the board cannot render");
        return;
      }
      latestRef.current = data;
      setState(data);
    }
    function handleSold(result: Extract<AuctionResult, { status: "SOLD" }>) {
      if (replaying) return;
      onSoldRef.current?.(result);
    }
    function handleUnsold(result: Extract<AuctionResult, { status: "UNSOLD" }>) {
      if (replaying) return;
      onUnsoldRef.current?.(result);
    }
    // `connected` and `polling` now track the socket through
    // useSyncExternalStore, so connecting only has to re-read the board.
    function handleConnect() {
      replaying = true;
      fetchAuctionState().then((data) => {
        if (cancelled) return;
        if (data) handleState(data);
        // Whatever arrives from here on is a genuine broadcast, not the replay.
        replaying = false;
      });
    }

    socket.on("connect", handleConnect);
    socket.on("auction:state", handleState);
    socket.on("auction:sold", handleSold);
    socket.on("auction:unsold", handleUnsold);

    fetchAuctionState().then((data) => {
      if (!cancelled && data) handleState(data);
    });

    return () => {
      cancelled = true;
      socket.off("connect", handleConnect);
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
    let lastVersion: string | null = null;
    let lastFullFetch = 0;

    async function tick() {
      clearTimeout(timer);
      if (!inFlight) {
        inFlight = true;
        try {
          const version = await fetchStateVersion();
          if (cancelled) return;

          const stale = Date.now() - lastFullFetch > FULL_REFRESH_EVERY_MS;
          const changed = version === null || version !== lastVersion;

          if (changed || stale) {
            const data = await fetchAuctionState();
            if (cancelled) return;
            if (data) {
              applyPolled(data);
              lastVersion = version;
              lastFullFetch = Date.now();
              setPollOk(true);
            } else {
              setPollOk(false);
            }
          } else {
            setPollOk(true);
          }
        } catch {
          if (!cancelled) setPollOk(false);
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
