# VoiceStack auction socket relay

A standalone Socket.IO server that broadcasts auction events to every screen in
the room. Deploy it on AWS; the Next.js app stays on Vercel.

## Why it exists

Vercel runs the app as serverless functions, which cannot hold a WebSocket open.
Without a relay the room falls back to polling `/api/auction/version` every 1.5s,
so the display board lags a bid behind. This process holds the sockets instead.

```
 browser (display / board / team)
      │  wss://   ── listens only
      ▼
 ┌─────────────────┐        POST /emit        ┌──────────────────────┐
 │  socket relay   │ ◀──── Bearer secret ──── │  Next.js on Vercel   │
 │   (this, AWS)   │                          │  the only writer     │
 └─────────────────┘                          └──────────┬───────────┘
                                                         │
                                                    MongoDB (Atlas)
```

It is a **relay and nothing more**: it holds no auction state and has no
database credentials. Every mutation still goes through the app's authenticated
API routes. The worst a stolen socket connection can do is watch.

## Endpoints

| Method | Path        | Auth              | Purpose                                  |
| ------ | ----------- | ----------------- | ---------------------------------------- |
| GET    | `/health`   | none              | Liveness, connected client count          |
| POST   | `/emit`     | `Bearer <secret>` | Broadcast `{ event, payload }` to the room |
| —      | `/socket.io`| none              | Where browsers connect                    |

A reconnecting client is replayed the latest payload for each event, so a
projector waking from sleep shows current figures immediately.

## Configuration

Copy `.env.example` to `.env` and fill it in. `SOCKET_EMIT_SECRET` is required —
the process refuses to boot without it.

```bash
openssl rand -hex 32      # use this for SOCKET_EMIT_SECRET
```

## Run locally

```bash
npm install
SOCKET_EMIT_SECRET=dev-secret npm run dev
curl localhost:4000/health
```

## TLS is not optional

The app is served over HTTPS, and **a browser refuses to open `ws://` from an
`https://` page** — it is blocked as mixed content. The relay must be reachable
over `wss://`, which means it needs a certificate. Every option below gives you
one; don't skip that step and expect it to work.

## Deploy on AWS

### Option A — App Runner (simplest, HTTPS included)

Gives you a managed `https://` URL with no load balancer or certificate work.

```bash
aws ecr create-repository --repository-name voicestack-socket
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin <acct>.dkr.ecr.ap-south-1.amazonaws.com

docker build --platform linux/amd64 -t voicestack-socket .
docker tag voicestack-socket <acct>.dkr.ecr.ap-south-1.amazonaws.com/voicestack-socket:latest
docker push <acct>.dkr.ecr.ap-south-1.amazonaws.com/voicestack-socket:latest
```

Then create an App Runner service from that image with:

- Port `4000`
- Health check path `/health`
- Environment: `SOCKET_EMIT_SECRET`, `ALLOWED_ORIGINS`
- **Instances: 1.** Scaling to several instances splits the room across
  processes, and a bid broadcast by one is not seen by clients on another. If you
  ever need more than one, add the Socket.IO Redis adapter first.

### Option B — EC2 + nginx (most control)

```bash
sudo dnf install -y nginx       # Amazon Linux 2023
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo dnf install -y nodejs

git clone <repo> && cd voicestack-cricket/socket-server
npm ci && npm run build

sudo tee /etc/systemd/system/voicestack-socket.service >/dev/null <<'UNIT'
[Unit]
Description=VoiceStack auction socket relay
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/voicestack-cricket/socket-server
EnvironmentFile=/home/ec2-user/voicestack-cricket/socket-server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl enable --now voicestack-socket
```

nginx must forward the WebSocket upgrade headers, or the handshake fails:

```nginx
server {
  server_name socket.example.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # required
    proxy_set_header Connection "upgrade";       # required
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;                    # don't cut idle sockets
  }
}
```

Then `sudo dnf install -y certbot python3-certbot-nginx && sudo certbot --nginx`.

Open **only** 80/443 in the security group — keep 4000 closed to the internet.

## Point the app at it

Set these in the Vercel project (Production), then redeploy:

| Variable                 | Value                                  |
| ------------------------ | -------------------------------------- |
| `SOCKET_SERVER_URL`      | `https://socket.example.com`            |
| `SOCKET_EMIT_SECRET`     | the same secret as the relay            |
| `NEXT_PUBLIC_SOCKET_URL` | `https://socket.example.com`            |

`NEXT_PUBLIC_SOCKET_URL` is read at build time, so it only takes effect on a
fresh deploy.

## Verify

```bash
curl https://socket.example.com/health
# {"ok":true,"clients":0,...}

curl -X POST https://socket.example.com/emit \
  -H "Authorization: Bearer $SOCKET_EMIT_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"event":"auction:state","payload":{"ping":true}}'
```

Open `/display`, then place a bid: it should move with no perceptible delay. The
"Reconnecting" badge showing in the room means clients could not reach the relay
and are polling — check `ALLOWED_ORIGINS` and that the URL is `https`.

## If the relay is down

Nothing breaks. `broadcastAuction` gives up after 2s and the app's own polling
keeps every screen correct, about 1.5s behind.
