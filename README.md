# GuardianSOC

Enterprise SOC incident management platform — React frontend, Express API, PostgreSQL (Aiven).

**No Firebase. No AI Studio. Runs entirely on your machine.**

## Project layout

```
guardiansoc/
├── backend/     # Express REST API (port 3001)
├── frontend/    # Vite + React UI (port 5173)
└── .env         # Your secrets (not committed)
```

## Quick start

> Run workspace commands from the **project root** (`guardiansoc/`), not from `backend/` or `frontend/`.

### 1. Install

```bash
cd C:\Users\kamle\guardiansoc
npm run install:all
```

From `backend/` only: `npm run install:all` installs backend + frontend deps (root deps still need `npm install` in the parent folder once).

### 2. Configure database

Copy `.env.example` to `.env` in the project root and set your Aiven `DATABASE_URL`:

```env
DATABASE_URL=postgres://user:password@host:port/defaultdb?sslmode=require
PORT=3001
FRONTEND_URL=http://localhost:5173
APP_URL=http://localhost:3001
```

### 3. Initialize schema

```bash
npm run init-db
```

On Windows, if SSL errors occur:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; npm run init-db
```

### 4. Run locally

```bash
npm run dev
```

| Service   | URL |
|-----------|-----|
| Dashboard | http://localhost:5173 |
| API       | http://localhost:3001 |
| Health    | http://localhost:3001/api/health |

## Features (current)

- Incident CRUD with severity-based SLA (24h / 48h / 72h)
- Background SLA monitor (warnings + breach flags)
- Keyword routing rules (exact, regex, fuzzy) with priority
- Users, roles, assignment rules (Admin tab)
- Evidence upload (local `backend/uploads/`)
- Email action links (`/api/tickets/confirm-action`)
- Audit logging, host-based correlation
- CSV import/export, themes (Cyber / Midnight / Light)

## Production build

```bash
npm run build
npm run start
```

Serves API + built frontend from `frontend/dist` when present.

## Docker

```bash
docker build -t guardiansoc .
docker run -p 3001:3001 -e DATABASE_URL="your_url" -e NODE_ENV=production guardiansoc
```

## Security note

Never commit `.env` or database passwords. Rotate credentials if they were shared in chat logs.
