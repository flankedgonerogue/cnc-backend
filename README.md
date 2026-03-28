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

### Authentication
| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/auth/register` | Register with email/password | ❌ |
| POST | `/auth/login` | Login with email/password | ❌ |
| GET | `/auth/profile` | Get current user | ✅ JWT |
| GET | `/auth/verify` | Verify JWT token | ✅ JWT |
| GET | `/auth/google` | Start Google OAuth flow | ❌ |
| GET | `/auth/google/callback` | Google OAuth callback | ❌ |
| POST | `/auth/oauth/role` | Initialize role for OAuth users | ✅ JWT |

### Templates
| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/templates` | Create story template | ✅ THERAPIST |
| GET | `/templates` | List templates | ✅ THERAPIST |
| GET | `/templates/:id` | Get template | ✅ THERAPIST |
| PATCH | `/templates/:id` | Update template | ✅ THERAPIST |
| DELETE | `/templates/:id` | Delete template | ✅ THERAPIST |

### Sessions (Chronicles N Conversations)
| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/sessions/initialize` | Start new story session | ✅ GUARDIAN/CHILD |
| POST | `/sessions/choice` | Make choice & continue story | ✅ GUARDIAN/CHILD |
| GET | `/sessions/:id` | Get session details | ✅ JWT |

### Story (AI Narrative Generation)
| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/story/start` | Initialize story with session | ✅ THERAPIST/CHILD |
| POST | `/story/continue` | Continue story with choice | ✅ THERAPIST/CHILD |
| GET | `/story/:sessionId/analytics` | Get behavioral analytics | ✅ THERAPIST/CHILD |

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
- `docs/auth/endpoints.md` — Auth API reference

If you want the docs consolidated, tell me which ones to keep and I’ll slim them down.