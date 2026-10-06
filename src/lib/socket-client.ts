import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let realtimeUnavailable = false;
const listeners = new Set<() => void>();

function setUnavailable(next: boolean) {
  if (realtimeUnavailable === next) return;
  realtimeUnavailable = next;
  listeners.forEach((listener) => listener());
}

/**
 * Where the WebSocket lives. With NEXT_PUBLIC_SOCKET_URL set, that is the
 * standalone relay (see ./socket-server) — the production path, because a
 * serverless host cannot hold a socket open. Unset means same-origin, which
 * works when the app is served by the custom Node server in server.js.
 *
 * It must be https/wss in production: a page served over https cannot open a
 * ws:// connection, the browser blocks it as mixed content.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

// Where no socket endpoint exists at all, every handshake fails. Cap the
// retries so we stop hammering it, and flag the failure so callers can fall
// back to polling /api/auction/version.
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL ?? undefined, {
      path: "/socket.io",
      // The relay sits on another origin, where only websocket is dependable:
      // long-polling across origins needs sticky sessions to survive a second
      // request landing on a different instance.
      transports: SOCKET_URL ? ["websocket"] : ["polling", "websocket"],
      withCredentials: !SOCKET_URL,
      autoConnect: true,
      // Where a relay is configured it is expected to exist, so keep trying for
      // the length of the event — a projector that drops off wifi must come
      // back on its own. Without one, stop after a few failed handshakes.
      reconnectionAttempts: SOCKET_URL ? Infinity : 5,
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
