const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Preserve public host/proto from reverse proxies (ngrok, etc.)
    const proto = req.headers["x-forwarded-proto"];
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host && !req.headers["x-forwarded-host"]) {
      req.headers["x-forwarded-host"] = host;
    }
    if (!proto) {
      req.headers["x-forwarded-proto"] = "http";
    }

    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  // Sockets are a broadcast-only channel: every client joins the single
  // "auction" room and just listens. All mutations go through authenticated
  // Next.js API routes (src/app/api/auction/*), which call into
  // src/lib/services/auction-service.ts and then broadcast via this same
  // io instance (exposed as global._io) — so the socket layer never needs
  // its own session/auth handling.
  io.on("connection", (socket) => {
    socket.join("auction");
  });

  global._io = io;

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://localhost:${port}`);
    });
});
