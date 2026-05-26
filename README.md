# ⬡ Webhook Service

Discord-style webhook service running on **saayem.qzz.io** via cloudflared tunnel.

## Stack

| Layer | Tech |
|---|---|
| Server | Fastify 5 (fastest Node.js framework) |
| Database | `node:sqlite` (built-in Node 22+, zero deps) |
| Real-time | SSE (Server-Sent Events) |
| Logging | Custom chalk logger (Render.com style) |
| UI | Vanilla JS + CSS (no framework) |

## Quick Start

```bash
# 1. Install
npm install

# 2. Start
npm start

# 3. Dev mode (auto-restart on file change)
npm run dev
```

Server runs on `http://localhost:3000` → exposed via cloudflared as `https://saayem.qzz.io`

## How It Works

1. Open `https://saayem.qzz.io` in browser
2. Register a username (e.g. `saayem`)
3. Go to **Generate URL** → select username → click Generate
4. You get a URL like: `https://saayem.qzz.io/hooks/saayem/AbCdEfGhIjKlMnOp`
5. Trigger it from anywhere:

```bash
# POST with JSON
curl -X POST "https://saayem.qzz.io/hooks/saayem/AbCdEfGhIjKlMnOp" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from GitHub Actions!"}'

# GET with query param
curl "https://saayem.qzz.io/hooks/saayem/AbCdEfGhIjKlMnOp?content=Hello+World"
```

6. Server logs it in the terminal + pushes to the Live Feed tab in real time

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Register username |
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/:username` | Get user + their webhooks |
| `POST` | `/api/webhooks/generate` | Generate webhook URL |
| `POST` | `/hooks/:username/:id` | **Trigger webhook** |
| `GET` | `/hooks/:username/:id` | Trigger webhook (GET) |
| `GET` | `/api/events` | SSE live feed |
| `GET` | `/health` | Health check |

## Cloudflared Setup

Your cloudflared tunnel should already route `saayem.qzz.io → localhost:3000`.
The server sets `trustProxy: true` so real IPs are captured from `X-Forwarded-For`.

## Security Notes

- Rate limiting: 120 req/min per IP (global)
- Helmet headers enabled (CSP, HSTS, etc.)
- Input validation via Fastify's AJV schema
- Username pattern enforced: `[a-zA-Z0-9_-]` only
- No secrets stored — webhook IDs are random nanoid tokens
- XSS protection in UI via manual HTML escaping (no innerHTML with raw data)
# Webhook
