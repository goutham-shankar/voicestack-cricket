import type { Server } from "socket.io";

declare global {
  var _io: Server | undefined;
}

export function getIO(): Server | undefined {
  return global._io;
}

export function broadcastAuction(event: string, payload: unknown) {
  getIO()?.to("auction").emit(event, payload);
}
