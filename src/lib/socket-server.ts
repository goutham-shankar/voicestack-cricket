import type { Server } from "socket.io";

declare global {
  var _io: Server | undefined;
}

/**
 * Only the custom Node server in server.js sets this, so it exists when the app
 * is self-hosted and never on a serverless host.
 */
export function getIO(): Server | undefined {
  return global._io;
}

/**
 * Pushes an auction event to every screen in the room.
 *
 * There are two ways that happens, tried in order:
 *
 *  1. SOCKET_SERVER_URL — the standalone relay in ./socket-server, which holds
 *     the WebSockets a serverless host cannot. This is the production path on
 *     Vercel.
 *  2. The in-process Socket.IO server from server.js, when self-hosting.
 *
 * With neither configured this is a no-op and clients fall back to polling
 * /api/auction/version (see src/lib/use-auction-state.ts), so a missing relay
 * degrades the room to a 1.5s delay rather than breaking it.
 */
export async function broadcastAuction(event: string, payload: unknown): Promise<void> {
  const local = getIO();
  if (local) {
    local.to("auction").emit(event, payload);
    return;
  }

  const url = process.env.SOCKET_SERVER_URL;
  const secret = process.env.SOCKET_EMIT_SECRET;
  if (!url || !secret) return;

  try {
    const res = await fetch(new URL("/emit", url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ event, payload }),
      // The relay is a nicety, not the source of truth. Never let it hold up
      // the operator's response: polling will carry the room if this times out.
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      console.warn(`socket relay refused ${event}: ${res.status}`);
    }
  } catch (error) {
    console.warn(
      `socket relay unreachable for ${event}:`,
      error instanceof Error ? error.message : error
    );
  }
}
