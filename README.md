# LMF Quota Monitor

A minimal, read-only dashboard for monitoring Google Cloud Code API quotas across multiple accounts.

![Dashboard Preview](https://img.shields.io/badge/status-live-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Real-time quota display** - 5-hour rolling window quotas for Claude and Gemini models
- **Multi-account support** - Monitor multiple Google accounts simultaneously
- **WebSocket updates** - Live updates every 2 minutes without page refresh
- **Privacy-focused** - Emails are anonymized in the UI and API responses
- **Lightweight** - ~500 lines of code, minimal dependencies

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | [Hono](https://hono.dev/) + Node.js |
| Frontend | React 18 + Zustand + Tailwind CSS |
| Build | Vite + TypeScript |
| Deploy | Docker + Traefik |

## Quick Start

### Development

```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3456

### Production

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```bash
docker compose up -d
```

## Configuration

Create an accounts file at `~/.config/opencode/antigravity-accounts.json`:

```json
{
  "version": 1,
  "accounts": [
    {
      "email": "user@gmail.com",
      "refreshToken": "your-refresh-token",
      "projectId": "optional-project-id"
    }
  ],
  "activeIndex": 0
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/accounts` | Get all accounts with quotas |
| `POST` | `/api/accounts/refresh` | Force refresh all quotas |
| `WS` | `/ws` | Real-time WebSocket updates |

### Example Response

```json
[
  {
    "email": "us***@gmail.com",
    "isActive": true,
    "quota": {
      "claudeQuotaPercent": 75,
      "geminiQuotaPercent": 100,
      "claudeResetTime": 1768146122000,
      "models": [...]
    }
  }
]
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server port |
| `QUOTA_POLL_INTERVAL` | `120000` | Polling interval in ms |
| `GOOGLE_CLIENT_ID` | Required | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Required | OAuth client secret |

## Project Structure

```
├── backend/
│   └── src/
│       ├── index.ts          # Hono server
│       ├── types.ts          # Shared types
│       └── services/
│           ├── accounts.ts   # File watching
│           └── quota.ts      # Cloud Code API
├── frontend/
│   └── src/
│       ├── App.tsx           # Main UI
│       ├── store.ts          # Zustand state
│       ├── lib/api.ts        # WebSocket + fetch
│       └── components/
│           ├── AccountCard.tsx
│           └── QuotaBar.tsx
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## License

MIT
