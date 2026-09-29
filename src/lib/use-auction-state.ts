"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { AuctionResult, FullAuctionState } from "@/lib/auction-types";

async function fetchAuctionState(): Promise<FullAuctionState | null> {
  const res = await fetch("/api/auction/state");
  if (!res.ok) return null;
  return res.json();
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
  const onSoldRef = useRef(onSold);
  const onUnsoldRef = useRef(onUnsold);

  useEffect(() => {
    onSoldRef.current = onSold;
    onUnsoldRef.current = onUnsold;
  }, [onSold, onUnsold]);

  useEffect(() => {
    let cancelled = false;

    fetchAuctionState().then((data) => {
      if (!cancelled && data) setState(data);
    });

    const socket = getSocket();

    function handleState(data: FullAuctionState) {
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
      fetchAuctionState().then((data) => {
        if (!cancelled && data) setState(data);
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

    return () => {
      cancelled = true;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("auction:state", handleState);
      socket.off("auction:sold", handleSold);
      socket.off("auction:unsold", handleUnsold);
    };
  }, []);

  return { state, connected };
}
