import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server, type Socket } from "socket.io";
import { config } from "./config.js";

/**
 * A broadcast relay, and deliberately nothing more.
 *
 * The Next.js app stays the only thing that reads or writes the database and
 * the only thing that authenticates a user. When it changes the auction it
 * POSTs the event here, and this process fans it out to every connected screen.
 * That split is what lets the app keep living on a serverless host, which
 * cannot hold a WebSocket open, while the room still updates instantly.
 *
 * Because it holds no auction state, it needs no database credentials: the
 * worst a stolen socket connection can do is watch.
 */

/**
 * The last payload seen for each event. A screen that reconnects — a projector
 * waking up, a phone coming back on wifi — is handed the current values at once
 * instead of sitting on stale ones until the next bid.
 */
const lastByEvent = new Map<string, unknown>();

function corsOrigin(): true | string[] {
  return config.allowedOrigins.length ? config.allowedOrigins : true;
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

/** Reads a JSON body, refusing anything over the configured cap. */
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > config.maxBodyBytes) {
      throw new Error(`Body larger than ${config.maxBodyBytes} bytes`);
    }
    chunks.push(chunk as Buffer);
  }

  if (!size) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * Compares the bearer token in constant time, so a caller cannot learn the
 * secret from how long a rejection takes.
 */
function authorised(req: IncomingMessage): boolean {
  const header = req.headers.authorization ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = config.emitSecret;

  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // Socket.IO handles its own path on this same server.
  if (url.pathname.startsWith("/socket.io")) return;

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      clients: io.of("/").sockets.size,
      events: [...lastByEvent.keys()],
      uptimeSeconds: Math.round(process.uptime()),
    });
  }

  if (req.method === "POST" && url.pathname === "/emit") {
    if (!authorised(req)) return json(res, 401, { error: "Unauthorized" });

    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "Malformed body",
      });
    }

    const { event, payload } = (body ?? {}) as { event?: unknown; payload?: unknown };
    if (typeof event !== "string" || !event) {
      return json(res, 400, { error: "`event` must be a non-empty string" });
    }

    lastByEvent.set(event, payload ?? null);
    io.to(config.room).emit(event, payload ?? null);

    return json(res, 200, { ok: true, clients: io.of("/").sockets.size });
  }

  return json(res, 404, { error: "Not found" });
});

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: { origin: corsOrigin(), credentials: true },
  // The app is the only writer, so a client never sends anything up. Keeping
  // the ping window short means a dropped projector is noticed quickly.
  pingInterval: 20000,
  pingTimeout: 10000,
});

io.on("connection", (socket: Socket) => {
  socket.join(config.room);
  for (const [event, payload] of lastByEvent) socket.emit(event, payload);
});

httpServer.listen(config.port, "0.0.0.0", () => {
  const origins = config.allowedOrigins.length
    ? config.allowedOrigins.join(", ")
    : "any (set ALLOWED_ORIGINS in production)";
  console.log(`socket relay listening on :${config.port}`);
  console.log(`  allowed origins: ${origins}`);
});

/** Let a load balancer drain connections before the process goes away. */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, closing`);
    io.close(() => httpServer.close(() => process.exit(0)));
    // Don't let a stuck socket hold the deploy open forever.
    setTimeout(() => process.exit(0), 10000).unref();
  });
}
