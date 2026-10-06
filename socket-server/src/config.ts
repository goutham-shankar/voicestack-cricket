/** Reads and validates the environment once, so a misconfigured box fails at boot. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. See socket-server/.env.example for what this server needs.`
    );
  }
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 4000,

  /**
   * Shared secret the Next.js app presents on /emit. This is the only thing
   * standing between the internet and the ability to broadcast to every screen
   * in the room, so it is required rather than defaulted.
   */
  emitSecret: required("SOCKET_EMIT_SECRET"),

  /**
   * Browser origins allowed to open a socket. Empty means "any", which is only
   * sensible while developing — in production list the app's real origins.
   */
  allowedOrigins: list("ALLOWED_ORIGINS"),

  /** The room every client joins. One auction, one room. */
  room: "auction",

  /** Largest /emit body accepted, in bytes. Broadcasts are tiny by design. */
  maxBodyBytes: 64 * 1024,
} as const;
