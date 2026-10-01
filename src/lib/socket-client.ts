import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let realtimeUnavailable = false;
const listeners = new Set<() => void>();

function setUnavailable(next: boolean) {
  if (realtimeUnavailable === next) return;
  realtimeUnavailable = next;
  listeners.forEach((listener) => listener());
}

// Socket.io only exists when the app is served by the custom Node server in
// server.js. Hosts that run just the `next build` output (Vercel and other
// serverless platforms) have no /socket.io endpoint, so every handshake 404s.
// Cap the retries so we stop hammering it, and flag the failure so callers can
// fall back to polling /api/auction/state.
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 5000,
    });

    socket.on("connect", () => setUnavailable(false));
    // A single failed handshake is enough to start polling: where sockets do
    // work the first attempt succeeds, and a later `connect` clears the flag.
    socket.on("connect_error", () => setUnavailable(true));
    socket.on("disconnect", () => setUnavailable(true));
  }
  return socket;
}

export function isRealtimeUnavailable(): boolean {
  return realtimeUnavailable;
}

export function onRealtimeAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
