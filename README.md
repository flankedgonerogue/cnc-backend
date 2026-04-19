# CNC Backend

NestJS backend powering authentication and user management, backed by Prisma and PostgreSQL.

## Overview
This service provides:
- Email/password registration and login
- Google OAuth 2.0 login
- JWT-based authentication
- Role initialization flow for OAuth users
- Prisma-based data access
- **Chronicles N Conversations** - AI-powered therapeutic storytelling engine

## Tech Stack
- **Framework:** NestJS 11
- **Language:** TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Auth:** Passport (Local, JWT, Google OAuth)

## Requirements
- Node.js (LTS recommended)
- npm
- PostgreSQL database

## Setup

1. **Install dependencies**
   ```/dev/null/README.md#L1-3
   npm install
   ```

2. **Create `.env`**
   ```/dev/null/README.md#L1-6
   cp .env.example .env
   ```

3. **Configure environment variables**
   The following are used by the app:

   ```/dev/null/README.md#L1-16
   # Required
   DATABASE_URL=postgresql://user:password@localhost:5432/cnc

   # JWT
   JWT_SECRET=your-secret
   JWT_EXPIRES_IN=7d

   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

   # Server (optional)
   PORT=3000
   BACKEND_URL=http://localhost:3000
   FRONTEND_URL=http://localhost:3001
   FRONTEND_SUCCESSFUL_PAIRING_URL=http://localhost:3001/pairing/success
   FRONTEND_ERROR_URL=http://localhost:3001/pairing/error
   ```

4. **Run migrations**
   ```/dev/null/README.md#L1-3
   npm run prisma:migrate
   ```

5. **Start the server**
   ```/dev/null/README.md#L1-3
   npm run start:dev
   ```

The server runs at `http://localhost:3000`.

## Key Endpoints

### Authentication (REST)
| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/auth/register` | Register with email/password (`GUARDIAN` / `CHILD`) | ❌ |
| POST | `/auth/login` | Login with email/password | ❌ |
| GET | `/auth/profile` | Get current user | ✅ JWT |
| GET | `/auth/verify` | Verify JWT token | ✅ JWT |
| GET | `/auth/google` | Start Google OAuth flow | ❌ |
| GET | `/auth/google/callback` | Google OAuth callback | ❌ |
| POST | `/auth/oauth/role` | Initialize role for OAuth users (`GUARDIAN` / `CHILD`) | ✅ JWT |
| POST | `/auth/password-reset/request` | Request password reset email | ❌ |
| POST | `/auth/password-reset/validate` | Validate reset token | ❌ |
| POST | `/auth/password-reset/confirm` | Set new password with token | ❌ |

GraphQL equivalents (`register`, `login`, `profile`, `verifyToken`, `setOAuthRole`, password-reset mutations) are documented in `docs/auth/endpoints.md`.

### Guardian-Child Pairing (GraphQL + REST callback)

- `addChild(createChildInput)` creates a new child account for a guardian and now requires `therapistEmail`.
- `myChildrenForGuardian` lists all children linked to the current guardian.
- `requestChildPairing(requestChildPairingInput)` sends a pairing email to an existing child account.
- Pairing confirmation callback: `GET /users/pairing/confirm?token=...` redirects to:
  - `FRONTEND_SUCCESSFUL_PAIRING_URL` on success
  - `FRONTEND_ERROR_URL` on failure

### Templates (GraphQL)

Therapist story templates: `createTemplate`, `templates`, `template`, `updateTemplate`, `removeTemplate` on `POST /graphql`. See `docs/template/endpoints.md`.

### Sessions (Chronicles N Conversations)
| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/sessions/initialize` | Start new story session | ✅ GUARDIAN/CHILD |
| POST | `/sessions/choice` | Make choice & continue story | ✅ GUARDIAN/CHILD |
| GET | `/sessions/:id` | Get session details | ✅ JWT |

### Story (GraphQL)

| Entry | Description |
| --- | --- |
| `POST /graphql` — `startStory`, `restartStory`, `continueStory`, `getSessionBehavioralAnalytics` | Interactive narrative and per-session analytics |

See `docs/story/endpoints.md`.

### Therapist analytics (GraphQL)

| Entry | Description |
| --- | --- |
| `POST /graphql` query `therapistDashboardAnalytics` | Cross-session dashboard (per-child trends, template stats, week/month windows) |

See `docs/analytics/endpoints.md`.

## Scripts

```/dev/null/README.md#L1-12
npm run start:dev       # Start dev server
npm run build           # Build
npm run start:prod      # Run production build
npm run test            # Unit tests
npm run test:e2e        # E2E tests
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run migrations
npm run prisma:studio   # Open Prisma Studio
```

## Documentation

Project docs live in `docs/`:
- `docs/QUICK_START.md` — Getting started and testing
- `docs/auth/endpoints.md` — Auth and admin HTTP API reference
- `docs/template/endpoints.md` — Template management (GraphQL, `visualStyle`)
- `docs/story/endpoints.md` — Story generation API
- `docs/session/endpoints.md` — Sessions API
- `docs/analytics/endpoints.md` — Therapist cross-session analytics (GraphQL)

If you want the docs consolidated, tell me which ones to keep and I’ll slim them down.