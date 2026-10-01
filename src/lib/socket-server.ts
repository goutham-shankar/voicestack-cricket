import type { Server } from "socket.io";

declare global {
  var _io: Server | undefined;
}

/**
 * Only the custom Node server in server.js sets this. On serverless hosts the
 * broadcasts below are no-ops and clients fall back to polling
 * /api/auction/state (see src/lib/use-auction-state.ts).
 */
export function getIO(): Server | undefined {
  return global._io;
}

export function broadcastAuction(event: string, payload: unknown) {
  getIO()?.to("auction").emit(event, payload);
}
